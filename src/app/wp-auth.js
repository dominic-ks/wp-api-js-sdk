function wpAuth( appDetails ) {
  
  //create the storage name for this app
  //uses the client key in the name so that multiple instances can be used
  var localStorageName = 'wp_rest_app_' + appDetails.clientKey;
  
  //check for a saved object
  if( localStorage.getItem( localStorageName ) !== null ) {
    
    //if there is a saved object, transfer it's properties and methods to this
    var savedObject = JSON.parse( localStorage.getItem( localStorageName ) );
    
    //loop through each property and and assign to this
    for( var key in savedObject ) { 
      this[ key ] = savedObject[ key ]; 
    }
    
    //check if we're receiving an oauthVerifier to catch tokens coming in on a redirect
    //NB. this is only relevant to browsers, native apps will trigger this elsewhere
    if( typeof( this.getGet().oauth_verifier ) !== 'undefined' ) {
      //split the url by the ?
      var parts = window.url().split( '?' );
      //process the results
      this.processAuthReady( parts[1] );
      //redirect to self minus the request params
      window.location = parts[0];
    }
    
    this.decideAuthAction();
    
  } else {
  
    //if no saved app details are found, we start building the object
    this.appDetails = appDetails;
    this.authTokens = {};

    //set the auth variales
    this.wpExecute({
      method: 'GET',
      url: this.appDetails.restURL + this.appDetails.jsonSlug,
      success: this.storeRESTroutes, 
      complete: this.decideAuthAction,
      sign: false,
    });
    
  }
  
}

wpAuth.prototype = {
  
  constructor: wpAuth,
  
  genericFunction : function() {},
  
  logError : function( message ) {
    console.log( message );
  },
  
  save: function() {
    
    localStorage.setItem( 'wp_rest_app_' + this.appDetails.clientKey , JSON.stringify( this ) );
    
  },
  
  decideAuthAction : function() {

    if( this.appStatus === 'verified' ) {

      //if the app has a verified status, assume we're good to go
      this.loggedInUser();
      
    } else if( this.appStatus === 'auth_ready' ) {
      
      var data = {
        oauth_token: this.authTokens.oauthToken,
        oauth_verifier: this.authTokens.oauthVerifier,
      }
      
      this.wpExecute({
        method: 'POST',
        url: this.restRoutes.authentication.oauth1.access + '?oauth_verifier=' + this.authTokens.oauthVerifier,
        success: this.storeAuthCredentials,
        complete: this.decideAuthAction,
        sign: true,
        data: data
      });

    } else {

      //otherwise get the temp credentials
      this.wpExecute({
        method: 'GET',
        url: this.restRoutes.authentication.oauth1.request,
        success: this.requestTempCredentials,
      });

    }

  },

  //process and ajax request
  wpExecute : function( request ) {
    
    //set defaults
    var defaults = {
      url: false,
      method: 'GET',
      success: this.genericFunction,
      error: this.genericFunction,
      complete: this.genericFunction,
      sign: true,
      data: {},
    }
    
    //check request object and set defaults
    for( var key in defaults ) { 
      if( typeof( request[ key ] ) === 'undefined' ) {
        request[ key ] = defaults[ key ];
      }
    }
    
    //check a URL has been provided
    if( request.url === false ) {
      this.logError( 'URL is required for the wpAuth.execute() method.' );
    }

    //swap out window.open function 
    //window.open = cordova.InAppBrowser.open;
    
    //sign the request unless it doesn't need it...
    if( request.sign === true ) {

      request.data.oauth_consumer_key = this.appDetails.clientKey;
      request.data.oauth_signature_method = 'HMAC-SHA1';
      request.data.oauth_timestamp = Math.floor( Date.now() / 1000 ).toString();
      request.data.oauth_nonce = this.getRandomString();
      request.data.oauth_version = this.restRoutes.authentication.oauth1.version;
      request.data.oauth_callback = this.appDetails.callBackURL;
      
      if( typeof( request.data.oauth_verifier ) !== 'undefined' ) {
        request.data.oauth_token = request.data.oauth_token;
        request.data.oauth_verifier = request.data.oauth_verifier;
      }
      
      var oauthTokenSecret = '';
      
      if( this.authTokens.oauthTokenSecret !== null ) { 
        oauthTokenSecret = this.authTokens.oauthTokenSecret;
      }

      request.data.oauth_signature = this.signRequest( request.method , request.url , request.data , this.appDetails.clientSecret , oauthTokenSecret );
      
    }

    //process the ajax
    $.ajax({
      method: request.method,
      url: request.url,
      data: request.data,
      success: request.success.bind( this ),
      error: request.error.bind( this ),
      complete: request.complete.bind( this ),
    });

  },

  //process and ajax request
  wpAjax : function( httpMethod , ajaxURL , successCallback , completeCallback , sign , requestData ) {

    //swap out window.open function 
    //window.open = cordova.InAppBrowser.open;
    
    var data = {};
    
    //sign the request unless it doesn't need it...
    if( sign === true ) {

      data = {
        oauth_consumer_key: this.appDetails.clientKey,
        oauth_signature_method: 'HMAC-SHA1',
        oauth_timestamp: Math.floor( Date.now() / 1000 ).toString(),
        oauth_nonce: this.getRandomString(),
        oauth_version: this.restRoutes.authentication.oauth1.version,
        oauth_callback: this.appDetails.callBackURL,
      }
      
      if( typeof( requestData.oauth_verifier ) !== 'undefined' ) {
        data.oauth_token = requestData.oauth_token;
        data.oauth_verifier = requestData.oauth_verifier;
      }
      
      var oauthTokenSecret = '';
      
      if( this.authTokens.oauthTokenSecret !== null ) { 
        oauthTokenSecret = this.authTokens.oauthTokenSecret;
      }

      data.oauth_signature = this.signRequest( httpMethod , ajaxURL , data , this.appDetails.clientSecret , oauthTokenSecret );
      
    }

    //process the ajax
    $.ajax({
      method: httpMethod,
      url: ajaxURL,
      data: data,
      success: successCallback.bind( this ),
      complete: completeCallback.bind( this ),
    });

  },
  
  requestTempCredentials : function( requestString ) {

    var getParams = this.getGet( requestString );
    
    //save the temp token secret
    this.authTokens.oauthTokenSecret = getParams.oauth_token_secret;
    this.save();

    //open / redirect to the auth screen
    var authWindow = window.open( this.restRoutes.authentication.oauth1.authorize + '/?' + requestString , '_self' , 'location=no,zoom=no' );

    //this only works for apps where an in-app browser window is utilised
    //otherwise the auth window will send the user back to the call back url and
    //will be picked up by decideAuthAction
    authWindow.addEventListener( 'loadstart' , function( InAppBrowserEvent ) {

      //split the url by the ?
      var parts = InAppBrowserEvent.url.split( '?' );

      //check if the url matches the call back url
      if( parts[0] !== this.appDetails.callBackURL ) {
        return; 
      }

      //if so close the auth window
      authWindow.close();
      
      //process the results
      this.processAuthReady( parts[1] );

    }.bind( this ) );
    
  },
  
  //store the auth urls
  storeRESTroutes : function( jsonRoutes ) {
    
    //store the entire routes object in a variable
    this.restRoutes = jsonRoutes;
    
    //store the new status
    this.appStatus = 'discovered';
    
    //store the last time this was updated
    this.lastUpdated = Math.floor( Date.now() / 1000 ).toString();
    
    //save the object
    this.save();
    
  },
  
  processAuthReady : function( requestString ) {
    
    var getParams = this.getGet( requestString );
      
    //save the retrieved tokens
    this.appStatus = 'auth_ready';
    this.authTokens.oauthToken = getParams.oauth_token;
    this.authTokens.oauthVerifier = getParams.oauth_verifier;
    this.save();
    
  },
  
  storeAuthCredentials : function( requestString ) {

    var getParams = this.getGet( requestString );
    
    this.authTokens.oauthVerifier = undefined;
    this.authTokens.oauthToken = getParams.oauth_token;
    this.authTokens.oauthTokenSecret = getParams.oauth_token_secret;
    this.appStatus = 'verified';
    
    this.save();
    
  },
  
  //function when we're logged in and rocking
  loggedInUser : function() {
    
    /*this.wpExecute({
      url: this.appDetails.cookielessURL + this.appDetails.jsonSlug + 'wp/v2/users/me',
      success: function( response ) {
        alert( 'Welcome ' + response.name );
      },
    });
    
    return;*/

    var httpMethod = 'GET';
    var url = this.appDetails.restURL + this.appDetails.jsonSlug + 'wp/v2/users/me';

    var data = {
      oauth_consumer_key: this.appDetails.clientKey,
      oauth_signature_method: 'HMAC-SHA1',
      oauth_timestamp: Math.floor( Date.now() / 1000 ).toString(),
      oauth_nonce: this.getRandomString(),
      oauth_version: this.restRoutes.authentication.oauth1.version,
      oauth_token: this.authTokens.oauthToken,
      oauth_token_secret: this.authTokens.oauthTokenSecret,
    }

    data.oauth_signature = this.signRequest( httpMethod , url , data , this.appDetails.clientSecret , this.authTokens.oauthTokenSecret );

    $.ajax({
      url: url.replace( this.appDetails.restURL , this.appDetails.cookielessURL ),
      method: httpMethod,
      data: data,

      success: function( response ) {

        alert( 'Welcome ' + response.name );

      },

    });

  },

  //sign requests
  signRequest : function( httpMethod , url , parameters , consumerSecret , tokenSecret ) {

    var signature = oauthSignature.generate( httpMethod , url , parameters , consumerSecret , tokenSecret , { encodeSignature: false } );

    return signature;

  },

  //generate random strings to use as nonces
  getRandomString : function() {

    var text = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    for( var i = 0; i < 10; i++ ) {
      text += possible.charAt( Math.floor( Math.random() * possible.length ) );
    }

    return text;

  },

  //return an object of GET parameters
  getGet : function( stringer ) {

    var paramObject = [];
    var tmp = [];

    if( typeof( stringer ) == 'undefined' ) {
      stringer = location.search.substr( 1 );
    }

    stringer.split( '&' ).forEach( function( item ) {
      tmp = item.split( '=' );
      paramObject[ tmp[0] ] = tmp[1];
    });

    return paramObject;

  }

}