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
variable "bedrock_model_id" {
  type    = string
  default = ""
}
variable "provider_mode" {
  type    = string
  default = "mock"
  validation {
    condition     = contains(["mock", "live"], var.provider_mode)
    error_message = "provider_mode must be mock or live."
  }
}
variable "provider_timeout_ms" {
  type    = number
  default = 3000
}
variable "amadeus_secret_id" {
  type    = string
  default = ""
}
variable "ticketmaster_secret_id" {
  type    = string
  default = ""
}
