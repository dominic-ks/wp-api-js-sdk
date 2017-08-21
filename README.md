# wp-api-js-sdk

This project is attempting to create a JS / jQuery library for connecting to a WordPress site via the WP REST API.

Initially designed for use with a Phonegap / Cordova application, it is TBC whether the scope will also cover browser applications due to security issues surrounding the client secret.Initially

# Installation - Via Composer

```
{
  "repositories": [
  {
    "type": "package",
    "package": {
      "name": "dominic-ks/oauth-signature-js",
      "version": "dev-master",
      "source": {
        "url": "https://github.com/dominic-ks/oauth-signature-js",
        "type": "git",
        "reference": "origin/master"
      }
    }
  },
  {
    "type": "package",
    "package": {
      "name": "dominic-ks/wp-api-js-sdk",
      "version": "dev-master",
      "source": {
        "url": "https://github.com/dominic-ks/wp-api-js-sdk",
        "type": "git",
        "reference": "origin/master"
      }
    }
  }],
  "require": {
    "dominic-ks/oauth-signature-js": "dev-master",
    "dominic-ks/wp-api-js-sdk": "dev-master"
  }
}
```
Then include both of these in your project:
```
/vendor/dominic-ks/oauth-signature/dist/oauth-signature.js
```
```
/vendor/dominic-ks/wp-api-js-sdk/src/app/wp-auth.js
```
#Other dependancies
<ul>
  <li>WordPres 4.5+</li>
  <li><a href="https://wordpress.org/plugins/rest-api-oauth1/">The Rest OAuth1a Server plugin</a></li>
  </ul>

# Basic usage

```
$( document ).ready( function() {

  //create the auth object
  var myAuth = new wpAuth({
    restURL : YOUR_REST_URL,
    cookielessURL : ADDITIONAL_COOKIELESS_REST_URL,
    jsonSlug : YOUR_JSON_SLUG, // e.g. 'wp/json/'
    clientKey : YOUR_CLIENT_KEY,
    clientSecret : YOUR_CLIENT_SECRET,
    callBackURL : YOUR_CALLBACK_URL,
    callbackFunction : appInit,
  });

  //trigger the authorization
  myAuth.authorize();

});

//call back function that will fire when / if the app is authorized
var appInit = function( authObject ) {

  //get the current users details and alert their name
  authObject.wpExecute({
    url: 'wp/v2/users/me/',
    success: function( response ) {
      alert( 'Welcome ' + response.name );
    },
  });

  //add a new post with title "My new test post"
  authObject.wpExecute({
    method: 'POST',
    url: 'wp/v2/posts/',
    success: function( response ) {
      console.log( response );
    },
    data: {
      title : 'My new test post',
    },
  });

}
```

# Options availble for wpAuth.wpExecute() method
 ```
 wpAuth.wpExecute({
  method: //string - optional default = 'GET' - http method - GET, POST, PATCH, DELETE
  url: //string - required - url endpoint - either full URL or from wp/v2/ onwards as per example
  success: //function - optional default = 'genericFunction()' (does nothing) - ajax success function to fire if request is successful
  error: //function - optional default = 'ajaxError()' (logs the error text to the console) - ajax error function to fire if request is unsucessful
  complete: //function - optional default = 'genericFunction()' (does nothing) - ajax complete function to fire when request has been completed
  sign: //bool - optional default = TRUE - whether or not to sign the request, generally not required
  data: //object - optional default = {} - JS object of params to send with the request
 });
 ```
  
# Notes
   - As mentioned above, it is generally recommended not to provide the client secret to a client side application as it provides the ability to others to trick users into authenticating a different app to use your service. However, for a Phonegap / Cordova app I have yet to find a solution to this that doesn't result in the same issue (sending ajax queries to a server to perform request signing or auth functions, for example).
  
   - ADDITIONAL_COOKIELESS_REST_URL is currently required when making authenticated requests to the WordPress Oauth 1.0 server due to this issue - https://github.com/WP-API/OAuth1/issues/156 - this is the easiest way I have found to date to send a request without a cookie by default
