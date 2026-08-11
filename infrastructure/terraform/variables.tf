variable "aws_region" {
  type    = string
  default = "us-east-1"
}
variable "environment" {
  type    = string
  default = "dev"
}
variable "session_ttl_days" {
  type    = number
  default = 30
  validation {
    condition     = var.session_ttl_days > 0
    error_message = "session_ttl_days must be positive."
  }
}
variable "sessions_lambda_zip" {
  type        = string
  description = "Path to the bundled sessions Lambda zip artifact."
}
