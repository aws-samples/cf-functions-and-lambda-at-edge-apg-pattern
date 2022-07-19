// https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/example-function-add-cache-control-header.html
function handler(event) {
    var response = event.response;
    var headers = response.headers;

    headers['cache-control'] = {value: 'public, max-age=63072000;'};

    // cannot modify response code from viewer response
    return response;
}