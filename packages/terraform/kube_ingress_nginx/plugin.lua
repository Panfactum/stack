-- This is the Panfactum plugin for customizing NGINX behavior at a deeper level
-- See https://github.com/kubernetes/ingress-nginx/blob/main/rootfs/etc/nginx/lua/plugins/README.md
-- Note that this CAN retrieve variables set by each ingresses' nginx.ingress.kubernetes.io/configuration-snippet annotation
-- which makes it very useful for customizing behavior on a per-ingress basis

local ngx = ngx

local _M = {}

-- Use this for mutating headers AFTER the server has received headers from the upstream
-- The variables are sourced from the Ingress annotations created by the kube_ingress module
function _M.header_filter()
  local content_type = ngx.header["Content-Type"]
  if content_type and content_type:find("html") then

    if ngx.var.pf_csp_enabled and (ngx.var.pf_csp_override or not ngx.header["Content-Security-Policy"]) then
      ngx.header["Content-Security-Policy"] = ngx.var.pf_csp
    end

    if ngx.var.pf_cross_origin_isolation_enabled then
      ngx.header["Cross-Origin-Embedder-Policy"] = ngx.var.pf_cross_origin_embedder_policy
      ngx.header["Cross-Origin-Opener-Policy"] = ngx.var.pf_cross_origin_opener_policy
    end

    if ngx.var.pf_permissions_policy_enabled and (ngx.var.pf_permissions_policy_override or not ngx.header["Permissions-Policy"]) then
      ngx.header["Permissions-Policy"] = ngx.var.pf_permissions_policy
    end

    ngx.header["X-XSS-Protection"] = ngx.var.pf_x_xss_protection
    ngx.header["X-Frame-Options"] = ngx.var.pf_x_frame_options
    ngx.header["Referrer-Policy"] = ngx.var.pf_referrer_policy

  else
    if ngx.var.pf_csp_enabled and (ngx.var.pf_csp_override or not ngx.header["Content-Security-Policy"]) then
      ngx.header["Content-Security-Policy"] = ngx.var.pf_csp_non_html
    end
  end
end

return _M