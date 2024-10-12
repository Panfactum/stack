'use strict';

exports.handler = async (event) => {
    const response = {
        status: '404',
        statusDescription: 'Not Found',
        headers: {
            'content-type': [{
                key: 'Content-Type',
                value: 'text/html'
            }]
        },
        body: '<html><body><h1>404 Not Found</h1></body></html>',
    };

    return response;
};
