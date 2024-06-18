-- This is the Panfactum plugin for customizing NGINX behavior at a deeper level
-- See https://github.com/kubernetes/ingress-nginx/blob/main/rootfs/etc/nginx/lua/plugins/README.md
-- Note that this CAN retrieve variables set by each ingresses' nginx.ingress.kubernetes.io/configuration-snippet annotation
-- which makes it very useful for customizing behavior on a per-ingress basis

local ngx = ngx

local _M = {}

-- Use this for mutating headers AFTER the server has received headers from the upstream
-- The variables are sourced from the Ingress annotations created by the kube_ingress module
--
-- NOTE: booleans nginx vars are stringified when accessed from lua
function _M.header_filter()
  local content_type = ngx.header["Content-Type"]
  local csp_enabled = ngx.var.pf_csp_enabled == "true"
  local csp_override = ngx.var.pf_csp_override == "true"

  if content_type and content_type:find("html") then

    if csp_enabled and (csp_override or not ngx.header["Content-Security-Policy"]) then
      ngx.header["Content-Security-Policy"] = ngx.var.pf_csp
    end

    local cross_origin_isolation_enabled = ngx.var.pf_cross_origin_isolation_enabled == "true"
    if cross_origin_isolation_enabled then
      ngx.header["Cross-Origin-Embedder-Policy"] = ngx.var.pf_cross_origin_embedder_policy
      ngx.header["Cross-Origin-Opener-Policy"] = ngx.var.pf_cross_origin_opener_policy
    end

    local permissions_policy_enabled = ngx.var.pf_permissions_policy_enabled == "true"
    local permissions_policy_override = ngx.var.pf_permissions_policy_override == "true"
    if permissions_policy_enabled and (permissions_policy_override or not ngx.header["Permissions-Policy"]) then
      ngx.header["Permissions-Policy"] = ngx.var.pf_permissions_policy
    end

    ngx.header["X-XSS-Protection"] = ngx.var.pf_x_xss_protection
    ngx.header["X-Frame-Options"] = ngx.var.pf_x_frame_options
    ngx.header["Referrer-Policy"] = ngx.var.pf_referrer_policy

  else
    if csp_enabled and (csp_override or not ngx.header["Content-Security-Policy"]) then
      ngx.header["Content-Security-Policy"] = ngx.var.pf_csp_non_html
    end
  end

  local cors_enabled = ngx.var.pf_cors_enabled == "true"
  if cors_enabled then
    local origin = ngx.var.http_origin
    if ngx.re.match(origin, "^" .. ngx.var.pf_cors_origin_regex .. "$", "jo") then
      ngx.header["Access-Control-Allow-Origin"] = origin
      ngx.header["Access-Control-Allow-Methods"] = ngx.var.pf_cors_allowed_methods
      ngx.header["Access-Control-Allow-Headers"] = ngx.var.pf_cors_allowed_headers
      ngx.header["Access-Control-Expose-Headers"] = ngx.var.pf_cors_exposed_headers
      ngx.header["Access-Control-Max-Age"] = ngx.var.pf_cors_max_age_seconds
      ngx.header["Access-Control-Allow-Credentials"] = ngx.var.pf_cors_allow_credentials
      local vary_header = ngx.header["Vary"]
      if vary_header then
          if not string.find(vary_header, "Origin", 1, true) then
              ngx.header["Vary"] = vary_header .. ", Origin"
          end
      else
          ngx.header["Vary"] = "Origin"
      end
    end
  end
end

-- Use this for processing the request BEFORE it has been sent to the upstream
function _M.rewrite()
  local cors_enabled = ngx.var.pf_cors_enabled == "true"
  if cors_enabled and ngx.var.request_method == "OPTIONS" then
    local origin = ngx.var.http_origin
    if ngx.re.match(origin, "^" .. ngx.var.pf_cors_origin_regex .. "$", "jo") then
      ngx.header["Access-Control-Allow-Origin"] = origin
      ngx.header["Access-Control-Allow-Methods"] = ngx.var.pf_cors_allowed_methods
      ngx.header["Access-Control-Allow-Headers"] = ngx.var.pf_cors_allowed_headers
      ngx.header["Access-Control-Expose-Headers"] = ngx.var.pf_cors_exposed_headers
      ngx.header["Access-Control-Max-Age"] = ngx.var.pf_cors_max_age_seconds
      ngx.header["Access-Control-Allow-Credentials"] = ngx.var.pf_cors_allow_credentials
      ngx.header["Content-Type"] = "text/plain charset=UTF-8"
      ngx.header["Content-Length"] = "0"
      ngx.header["Vary"] = "Origin"
      ngx.exit(204)
    end
  end
end


return _M