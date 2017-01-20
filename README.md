# wp-api-js-sdk

This project is attempting to create a JS / jQuery library for connecting to a WordPress site via the WP REST API.

Initially designed for use with a Phonegap / Cordova application, it is TBC whether the scope will also cover browser applications due to security issues surrounding the client secret.Initially

# Basic usage

```
var myAuth = new wpAuth({
  restURL : YOUR_REST_URL,
  cookielessURL : ADDITIONAL_COOKIELESS_REST_URL,
  jsonSlug : YOUR_JSON_SLUG, // e.g. 'wp/json/'
  clientKey : YOUR_CLIENT_KEY,
  clientSecret : YOUR_CLIENT_SECRET,
  callBackURL : YOUR_CALLBACK_URL
});
```
  
  At present this version of the sdk will automatically initiate the auth process once the above has been run.
  
  Once authorised, the sdk will automatically make a single call to /users/me and create an alert with your user's ```first_name + last_name``` simply to demostrate that the app has been authenticated.
  
# Notes
   - As mentioned above, it is generally recommended not to provide the client secret to a client side application as it provides the ability to others to trick users into authenticating a different app to use your service. However, for a Phonegap / Cordova app I have yet to find a solution to this that doesn't result in the same issue (sending ajax queries to a server to perform request signing or auth functions, for example).
  
   - ADDITIONAL_COOKIELESS_REST_URL is currently required when making authenticated requests to the WordPress Oauth 1.0 server due to this issue - https://github.com/WP-API/OAuth1/issues/156 - this is the easiest way I have found to date to send a request without a cookie by default
