'use strict';

// Load the redirect rules from the JSON file.
const redirectRules = require('./redirect-rules.json');

const parsedRules = redirectRules.map(({source, target, permanent}) => ({
    source: new RegExp(source),
    target,
    permanent
}))

exports.handler = async (event) => {
    const request = event.Records[0].cf.request;
    const uri = request.uri;
    const host = request.headers.host[0].value;
    const protocol = request.headers['cloudfront-forwarded-proto']
        ? request.headers['cloudfront-forwarded-proto'][0].value
        : 'https';

    // Construct the full URL.
    const fullUrl = `${protocol}://${host}${uri}`;

    // Iterate through the list of redirect rules.
    for (const {source, target, permanent} of parsedRules) {
        const match = fullUrl.match(source);

        if (match) {
            // Replace placeholders in the target URL with the matched groups.
            const newLocation = target.replace(/\$(\d+)/g, (_, group) => match[group] || '');

            // Return a 301 redirect response.
            return {
                status: permanent ? '301' : '302',
                statusDescription: permanent ? 'Moved Permanently' : 'Moved Temporarily',
                headers: {
                    location: [
                        {
                            key: 'Location',
                            value: newLocation,
                        }
                    ]
                }
            };
        }
    }

    // If no rule matches, proceed with the original request.
    return request;
};
