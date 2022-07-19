// function buildQuerystring(qs) {
//     return Object.entries(qs).map(x => `${x[0]}=${x[1].value}`).join("&");
// }
/* urls: 
 * /entry/1.json -> blog
 * /blog/id -> specific blog, redirect toabove format
 * /blog?author=ktinn&section=intro
 */
function handler(event) {
    var request = event.request;
    // var author = request.querystring.section.value;
    var parts = request.uri.split('/');
    var blogId = parts[parts.length - 1];
    var location = `/entry/${blogId}.json`;
    // var location = request.querystring.fields ?
    //     `/blog/${id}?${buildQuerystring(request.querystring)}` :
    //     `/blog/${id}/${id}-${language}-${marketplace}.json`;
    return {
        statusCode: 303,
        statusDescription: 'See Other',
        headers: {
            "location": { value: location }
        }
    };
}