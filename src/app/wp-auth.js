function wpAuth( appDetails ) {

  //set the object properties
  this.restURL = appDetails.restURL;
  this.cookielessURL = appDetails.cookielessURL;
  this.jsonSlug = appDetails.jsonSlug;
  this.clientKey = appDetails.clientKey;
  this.clientSecret = appDetails.clientSecret;
  this.callBackURL = appDetails.callBackURL;

  //set the auth variales
  this.wpAjax(
    'GET',
    this.restURL + this.jsonSlug,
    this.storeRESTroutes, 
    this.decideAuthAction,
    false,
    false
  );
  
}

wpAuth.prototype = {
  
  constructor: wpAuth,
  
  genericFunction : function() {},
  
  decideAuthAction : function() {

    if( localStorage.getItem( 'app_status' ) === 'verified' ) {

      //if the app has a verified status, assume we're good to go
      this.loggedInUser();

    } else if ( typeof( getGet().oauth_verifier ) !== 'undefined' ) {

      //if there's a oauth_verifier in the GET then try to get an access token
      //this is only for browsers
      
      var getParams = getGet();
      
      this.getAccessToken({
        oauth_token: getParams.oauth_token,
        oauth_verifier: getParams.oauth_verifier,
      });

    } else {

      //otherwise get the temp credentials
      this.wpAjax(
        'POST',
        this.requestURL,
        this.requestTempCredentials,
        this.genericFunction,
        true,
        false
      );

    }

  },

  //process and ajax request
  wpAjax : function( httpMethod , ajaxURL , successCallback , completeCallback , sign , tokenVerifier ) {

    //swap out window.open function 
    //window.open = cordova.InAppBrowser.open;
    
    var data = {};
    
    //sign the request unless it doesn't need it...
    if( sign === true ) {

      data = {
        oauth_consumer_key: this.clientKey,
        oauth_signature_method: 'HMAC-SHA1',
        oauth_timestamp: Math.floor( Date.now() / 1000 ).toString(),
        oauth_nonce: getRandomString(),
        oauth_version: this.version,
        oauth_callback: this.callBackURL,
      }
      
      if( tokenVerifier !== false ) {
        data.oauth_token = tokenVerifier.oauth_token;
        data.oauth_verifier = tokenVerifier.oauth_verifier;
      }
      
      var oauthTokenSecret = '';
      
      if( localStorage.getItem( 'oauth_token_secret' ) !== null ) { 
        oauthTokenSecret = localStorage.getItem( 'oauth_token_secret' );
      }

      data.oauth_signature = signRequest( httpMethod , ajaxURL , data , this.clientSecret , oauthTokenSecret );
      
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
  
  //store the auth urls
  storeRESTroutes : function( jsonRoutes ) {

    //on success just populate the urls
    this.accessURL = jsonRoutes.authentication.oauth1.access;
    this.authorizeURL = jsonRoutes.authentication.oauth1.authorize;
    this.requestURL = jsonRoutes.authentication.oauth1.request;
    this.version = jsonRoutes.authentication.oauth1.version;
    
  },
  
  requestTempCredentials : function( requestString ) {

    var getParams = getGet( requestString );
    
    localStorage.setItem( 'oauth_token_secret' ,  getParams.oauth_token_secret ); 

    var authWindow = window.open( this.authorizeURL + '/?' + requestString , '_blank' , 'location=no,zoom=no' );

    //this only works for apps where an in-app browser window is utilised
    //otherwise the auth window will send the user back to the call back url and
    //will be picked up by decideAuthAction
    authWindow.addEventListener( 'loadstart' , function( InAppBrowserEvent ) {

      var oauthToken;
      var oauthVerifier;

      parts = InAppBrowserEvent.url.split( '?' );

      if( parts[0] !== this.callBackURL ) {
        return; 
      }

      getParams = getGet( parts[1] );

      authWindow.close();
      
      this.getAccessToken({
        oauth_token: getParams.oauth_token,
        oauth_verifier: getParams.oauth_verifier,
      });

    });
    
  },
  
  storeAuthCredentials : function( requestString ) {

    var getParams = getGet( requestString );
    
    localStorage.setItem( 'app_status' ,  'verified' );
    localStorage.setItem( 'oauth_token' , getParams.oauth_token );
    localStorage.setItem( 'oauth_token_secret' , getParams.oauth_token_secret );
    
  },

  //get an access token
  getAccessToken : function( tokenVerifier) {
    
    var oauthVerifier = tokenVerifier.oauth_verifier;
    
    this.wpAjax(
      'POST',
      this.accessURL + '?oauth_verifier=' + oauthVerifier,
      this.storeAuthCredentials,
      this.decideAuthAction,
      true,
      tokenVerifier
    );

  },
  
  //function when we're logged in and rocking
  loggedInUser : function() {

    var httpMethod = 'GET';
    var url = this.restURL + this.jsonSlug + 'wp/v2/users/me';

    var data = {
      oauth_consumer_key: this.clientKey,
      oauth_signature_method: 'HMAC-SHA1',
      oauth_timestamp: Math.floor( Date.now() / 1000 ).toString(),
      oauth_nonce: getRandomString(),
      oauth_version: this.version,
      oauth_token: localStorage.getItem( 'oauth_token' ),
      oauth_token_secret: localStorage.getItem( 'oauth_token_secret' ),
    }

    data.oauth_signature = signRequest( httpMethod , url , data , this.clientSecret , localStorage.getItem( 'oauth_token_secret' ) );

    $.ajax({
      url: url.replace( this.restURL , this.cookielessURL ),
      method: httpMethod,
      data: data,

      success: function( response ) {

        alert( 'Welcome ' + response.name );

      },

    });

  },

}

//sign requests
function signRequest( httpMethod , url , parameters , consumerSecret , tokenSecret ) {
    
  var signature = oauthSignature.generate( httpMethod , url , parameters , consumerSecret , tokenSecret , { encodeSignature: false } );
  
  return signature;
  
}

//generate random strings to use as nonces
function getRandomString() {
  
  var text = "";
  var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for( var i = 0; i < 10; i++ ) {
    text += possible.charAt( Math.floor( Math.random() * possible.length ) );
  }
  
  return text;
  
}

//return an object of GET parameters
function getGet( stringer ) {
  
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