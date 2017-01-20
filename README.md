# wp-api-js-sdk

This project is attempting to create a JS / jQuery library for connecting to a WordPress site via the WP REST API.

Initially designed for use with a Phonegap / Cordova application, it is TBC whether the scope will also cover browser applications due to security issues surrounding the client secret.Initially

# Basic usage

  var myAuth = new wpAuth({
    restURL : YOUR_REST_URL,
    cookielessURL : ADDITIONAL_COOKIELESS_REST_URL,
    jsonSlug : YOUR_JSON_SLUG, // e.g. 'wp/json/'
    clientKey : YOUR_CLIENT_KEY,
    clientSecret : YOUR_CLIENT_SECRET,
    callBackURL : YOUR_CALLBACK_URL
  });
  
  At present this version of the sdk will automatically initiate the auth process once the above has been run.
  
  Once authorised, the sdk will automatically make a single call to /users/me and create an alert with your user's first_name + last_name