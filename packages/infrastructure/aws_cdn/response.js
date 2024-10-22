const corsRules = JSON.parse('${CORS_RULES}')

const corsEnabled = corsRules.enabled
const allowMethodsHeader = {value: corsRules.allowed_methods.join(',') };
const allowHeadersHeader = { value: corsRules.allowed_headers.join(',') };
const maxAgeHeader = { value: `$${corsRules.max_age}`};
const varyHeader = {value: "Origin" };
const allowedOrigins = {};
for (let i = 0; i < corsRules.allowed_origins.length; i++) {
    allowedOrigins[corsRules.allowed_origins[i]] = true;
}
const allowAllOrigins = allowedOrigins['*'] ? true : false;
function handler(event){
    const response = event.response;
    const request = event.request;
    const headers = response.headers;

    /////////////////////////////////////////////////////////////
    /// Step 1: Apply the CORS headers if the upstream did not provide them
    /////////////////////////////////////////////////////////////
    if(corsEnabled){
        const originHeader = request.headers['origin'] ? request.headers['origin'].value : '*';
        if (allowAllOrigins || allowedOrigins[originHeader]){
            headers['access-control-allow-origin'] = { value: originHeader };
            headers['access-control-allow-methods'] = allowMethodsHeader;
            headers['access-control-allow-headers'] = allowHeadersHeader;
            headers['access-control-max-age'] = maxAgeHeader;
            if(headers['vary']){
                const originalVary = headers['vary'].value
                if(!originalVary.includes('Origin')){
                    headers['vary'] = { value: originalVary + ", Origin" };
                }
            }else {
                headers['vary'] = varyHeader;
            }
        }
    }
    return response;
}