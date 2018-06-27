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
      //window.location = parts[0];
    }
    
    //trigger the decide next auth action
    //this.decideAuthAction();
    
  } else {
  
    //if no saved app details are found, we start building the object
    this.appDetails = appDetails;
    this.authTokens = {};
    this.cache = {};
    
  }
  
}

wpAuth.prototype = {
  
  constructor: wpAuth,
  
  //a generic function to point undefined success call backs from $.ajax
  genericSuccess : function( response ) {
    console.log( response );
  },
  
  //a generic function to point undefined complete call backs from $.ajax
  genericComplete : function( response ) {
    
    //check that this was a get request, otherwise clear the cache
    if( response.config.method !== 'GET' ) {
      this.clearCache( response );
      return false;
    }
    
    var requestRoute = response.config.url;
    
    //check that the result was not an error
    if( response.status != 200 ) {
      return false;
    }
    
    this.cache.lastUpdated = new Date();
    this.cache[ requestRoute ] = response.data;
    this.save();
    
  },
  
  //what to do with errors
  logError : function( message ) {
    console.log( message );
  },
  
  //handling of $.ajax errors, NB. default, no need to state explicitly
  ajaxError : function( xhr , status , error ) {
    console.log( xhr );
    this.logError( error + ': ' + xhr.responseText );
  },
  
  //save the current object to the local storage
  save : function() {
    localStorage.setItem( 'wp_rest_app_' + this.appDetails.clientKey , JSON.stringify( this ) );
  },
  
  //logout of the app - by default will delete everything from the local storage and redirect to the redirect URI
  logout : function() {
    localStorage.clear();
    window.location = this.appDetails.callBackURL;
  },
  
  clearCache : function( response ) {
    this.cache = {};
    this.save();
    this.nextReload( response );
  },
  
  nextReload : function( response ) {
    window.location.reload();
  },
  
  //direct a user to a url, given here so can be overwritten in case an in-app browser command is required instead
  //e.g. cordova.InAppBrowser.open
  openURL : function( url , target , params ) {
    var openWindow = window.open( url , target , params );
    return openWindow;
  },
  
  runCallbackFunction : function( name , args ) {
    var fn = window[ name ];
    if( typeof fn !== 'function' ) {
      return;      
    }
    fn.apply( window , args );
  },
  
  authorize : function() {
    this.decideAuthAction();
  },
  
  //decide the next action in the auth process
  decideAuthAction : function() {

    if( this.appStatus === 'verified' ) {

      //potential to do something if the app is verified...
      this.runCallbackFunction( this.appDetails.callbackFunction , [ this ] );
      
    //if we're ready to trigger auth...
    } else if( this.appStatus === 'auth_ready' ) {
      
      var data = {
        oauth_token: this.authTokens.oauthToken,
        oauth_verifier: this.authTokens.oauthVerifier,
      }
      
      this.wpExecute({
        method: 'POST',
        url: this.restRoutes.authentication.oauth1.access/* + '?oauth_verifier=' + this.authTokens.oauthVerifier*/,
        success: this.storeAuthCredentials,
        complete: this.decideAuthAction,
        sign: true,
        data: data,
        cache: false,
      });

    } else if( this.appStatus === 'discovered' ) {

      //otherwise get the temp credentials
      this.wpExecute({
        method: 'GET',
        url: this.restRoutes.authentication.oauth1.request,
        success: this.requestTempCredentials,
        cache: false,
      });

    } else {

      //set the auth variales
      this.wpExecute({
        url: this.appDetails.restURL + this.appDetails.jsonSlug,
        success: this.storeRESTroutes, 
        complete: this.decideAuthAction,
        sign: false,
        cache: false,
      });
      
    }

  },

  //function responsible for handling all auth and api calls
  wpExecute : function( request ) {
    
    //set defaults
    var defaults = {
      url: false,
      method: 'GET',
      success: this.genericSuccess,
      error: this.ajaxError,
      complete: this.genericComplete,
      sign: true,
      data: {},
      cache: true,
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
    
    //check if a full url has been parsed or only an endpoint slug
    if( request.url.indexOf( this.appDetails.restURL ) === -1 ) {
      request.url = this.appDetails.restURL + this.appDetails.jsonSlug + request.url;
    }
    
    //check for a cached request, NB only for GET methods
    if( request.cache === true && request.method === 'GET' ) {
      
      var cacheURL = request.url.replace( this.appDetails.restURL , this.appDetails.cookielessURL );
      
      if( typeof( this.cache[ cacheURL ] ) !== 'undefined' ) {
        return request.success( this.cache[ cacheURL ] );
      }
      
    }
    
    //sign the request unless it doesn't need it...
    if( request.sign === true ) {

      request.data.oauth_consumer_key = this.appDetails.clientKey;
      request.data.oauth_signature_method = 'HMAC-SHA1';
      request.data.oauth_timestamp = Math.floor( Date.now() / 1000 ).toString();
      request.data.oauth_nonce = this.getRandomString();
      request.data.oauth_version = this.restRoutes.authentication.oauth1.version;
      request.data.oauth_callback = this.appDetails.callBackURL;
      
      if( typeof( this.authTokens.oauthVerifier ) !== 'undefined' ) {
        request.data.oauth_verifier = this.authTokens.oauthVerifier;
      }
      
      if( typeof( this.authTokens.oauthToken ) !== 'undefined' ) {
        request.data.oauth_token = this.authTokens.oauthToken;
      }
      
      if( typeof( this.authTokens.oauthTokenSecret ) !== 'undefined' ) {
        request.data.oauth_token_secret = this.authTokens.oauthTokenSecret;
      }
      
      var oauthTokenSecret = '';
      
      if( typeof( this.authTokens.oauthTokenSecret ) !== 'undefined' && this.appStatus !== 'temp_credentials_received' ) { 
        oauthTokenSecret = this.authTokens.oauthTokenSecret;
      }

      //sign the request
      request.data.oauth_signature = this.signRequest( request.method , request.url , request.data , this.appDetails.clientSecret , oauthTokenSecret );
      
    }
    
    //process the ajax
    return this.wpExecuteRequest({
      method: request.method,
      url: request.url.replace( this.appDetails.restURL , this.appDetails.cookielessURL ),
      data: request.data,
      success: request.success.bind( this ),
      error: request.error.bind( this ),
      complete: request.complete.bind( this ),
    });

  },
  
  wpExecuteRequest : function( request ) {
    
    console.log( request );

    //process the ajax
    return $.ajax( request );
    
  },
  
  //success function for requesting credentials
  requestTempCredentials : function( requestString ) {
    
    requestString = this.processReturn( requestString );

    var getParams = this.getGet( requestString );
    
    //save the temp token secret
    this.authTokens.oauthTokenSecret = getParams.oauth_token_secret;
    this.appStatus = 'temp_credentials_received';
    this.save();

    //open / redirect to the auth screen
    window.authWindow = this.openURL( this.restRoutes.authentication.oauth1.authorize + '/?' + requestString , '_self' , 'location=no,zoom=no,clearcache=yes,clearsessioncache=yes,toolbar=no' );

    //this only works for apps where an in-app browser window is utilised
    //otherwise the auth window will send the user back to the call back url and
    //will be picked up by decideAuthAction
    window.authWindow.addEventListener( 'loadstart' , function( InAppBrowserEvent ) {

      //split the url by the ?
      var parts = InAppBrowserEvent.url.split( '?' );

      //check if the url matches the call back url
      if( parts[0] !== this.appDetails.callBackURL ) {
        return; 
      }

      //if so close the auth window
      window.authWindow.close();
      
      //process the results
      this.processAuthReady( parts[1] );
      
      this.decideAuthAction();

    }.bind( this ) );
    
  },
  
  //store the auth urls
  storeRESTroutes : function( jsonRoutes ) {
    
    jsonRoutes = this.processReturn( jsonRoutes );
    
    //store the entire routes object in a variable
    this.restRoutes = jsonRoutes;
    
    //store the new status
    this.appStatus = 'discovered';
    
    //store the last time this was updated
    this.lastUpdated = Math.floor( Date.now() / 1000 ).toString();
    
    //save the object
    this.save();
    
  },
  
  //process the auth ready, in a separate function so that is can be handled
  //whether pulled from an in-app browser window or by catching credentials on a callback
  processAuthReady : function( requestString ) {
    
    var getParams = this.getGet( requestString );
      
    //save the retrieved tokens
    this.appStatus = 'auth_ready';
    this.authTokens.oauthToken = getParams.oauth_token;
    this.authTokens.oauthVerifier = getParams.oauth_verifier;
    this.save();
    
  },
  
  //store the auth credentials when they've been retrieved
  storeAuthCredentials : function( requestString ) {
    
    requestString = this.processReturn( requestString );

    var getParams = this.getGet( requestString );
    
    this.authTokens.oauthVerifier = undefined;
    this.authTokens.oauthToken = getParams.oauth_token;
    this.authTokens.oauthTokenSecret = getParams.oauth_token_secret;
    this.appStatus = 'verified';
    
    this.save();
    
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

  //return an object of GET parameters either from a stated string, 
  //or pulls from current window.location if no string is provided
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

  },
  
  //process data returned from an ajax request
  //returns the param by default but can be overwritten if required, e.g. if using Angular $http
  processReturn : function( response ) {
    return response;
  }

}
