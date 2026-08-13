locals {
  name = "travel-concierge-${var.environment}"
}

resource "aws_dynamodb_table" "sessions" {
  name         = "${local.name}-sessions"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "PK"
  range_key    = "SK"
  attribute {
    name = "PK"
    type = "S"
  }
  attribute {
    name = "SK"
    type = "S"
  }
  ttl {
    attribute_name = "expiresAt"
    enabled        = true
  }
  point_in_time_recovery {
    enabled = true
  }
  server_side_encryption {
    enabled = true
  }
}

resource "aws_cloudwatch_log_group" "sessions" {
  name              = "/aws/lambda/${local.name}-sessions"
  retention_in_days = 30
}
resource "aws_iam_role" "sessions" {
  name               = "${local.name}-sessions"
  assume_role_policy = jsonencode({ Version = "2012-10-17", Statement = [{ Effect = "Allow", Principal = { Service = "lambda.amazonaws.com" }, Action = "sts:AssumeRole" }] })
}
resource "aws_iam_role_policy" "sessions" {
  name = "${local.name}-sessions-least-privilege"
  role = aws_iam_role.sessions.id
  policy = jsonencode({ Version = "2012-10-17", Statement = concat([
    { Effect = "Allow", Action = ["dynamodb:GetItem", "dynamodb:Query", "dynamodb:PutItem", "dynamodb:UpdateItem", "dynamodb:TransactWriteItems"], Resource = aws_dynamodb_table.sessions.arn },
    { Effect = "Allow", Action = ["bedrock:InvokeModel"], Resource = "*" },
    { Effect = "Allow", Action = ["logs:CreateLogStream", "logs:PutLogEvents"], Resource = "${aws_cloudwatch_log_group.sessions.arn}:*" },
    { Effect = "Allow", Action = ["xray:PutTraceSegments", "xray:PutTelemetryRecords"], Resource = "*" }
  ], length(compact([var.amadeus_secret_id, var.ticketmaster_secret_id])) > 0 ? [{ Effect = "Allow", Action = ["secretsmanager:GetSecretValue"], Resource = compact([var.amadeus_secret_id, var.ticketmaster_secret_id]) }] : []) })
}
resource "aws_lambda_function" "sessions" {
  function_name    = "${local.name}-sessions"
  role             = aws_iam_role.sessions.arn
  runtime          = "nodejs24.x"
  handler          = "handler.handler"
  filename         = var.sessions_lambda_zip
  source_code_hash = filebase64sha256(var.sessions_lambda_zip)
  timeout          = 20
  tracing_config {
    mode = "Active"
  }
  environment {
    variables = {
      SESSIONS_TABLE_NAME = aws_dynamodb_table.sessions.name
      SESSION_TTL_DAYS    = tostring(var.session_ttl_days)
      PROVIDER_MODE       = var.provider_mode
      BEDROCK_MODEL_ID    = var.bedrock_model_id
      PROVIDER_TIMEOUT_MS = tostring(var.provider_timeout_ms)
    }
  }
  depends_on = [aws_cloudwatch_log_group.sessions]
}
resource "aws_apigatewayv2_api" "http" {
  name          = "${local.name}-http"
  protocol_type = "HTTP"
}
resource "aws_apigatewayv2_integration" "sessions" {
  api_id                 = aws_apigatewayv2_api.http.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.sessions.invoke_arn
  payload_format_version = "2.0"
}
resource "aws_apigatewayv2_route" "sessions" {
  for_each  = toset(["POST /sessions", "POST /sessions/{sessionId}/messages", "POST /sessions/{sessionId}/approve", "GET /sessions/{sessionId}", "GET /sessions/{sessionId}/trip"])
  api_id    = aws_apigatewayv2_api.http.id
  route_key = each.value
  target    = "integrations/${aws_apigatewayv2_integration.sessions.id}"
}
resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.http.id
  name        = "$default"
  auto_deploy = true
}
resource "aws_lambda_permission" "api" {
  statement_id  = "AllowHttpApiInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.sessions.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.http.execution_arn}/*/*"
}
