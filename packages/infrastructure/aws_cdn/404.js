function handler(event) {
    return {
        statusCode: 404,
        statusDescription: 'Not Found',
        headers: {
            'content-type': {
                value: 'text/html'
            }
        },
        body: '<html><body><h1>404 Not Found</h1></body></html>',
    };
}
