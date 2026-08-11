output "api_endpoint" { value = aws_apigatewayv2_api.http.api_endpoint }
output "sessions_table_name" { value = aws_dynamodb_table.sessions.name }
