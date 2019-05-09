/*
 * Copyright (c) 2018, Okta, Inc. and/or its affiliates. All rights reserved.
 * The Okta software accompanied by this notice is provided pursuant to the Apache License, Version 2.0 (the "License.")
 *
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0.
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *
 * See the License for the specific language governing permissions and limitations under the License.
 */

/**
 * A simple web server that initializes the OIDC Middleware library with the
 * given options, and attaches route handlers for the example profile page
 * and logout functionality.
 */

const express = require('express');
const session = require('express-session');
const mustacheExpress = require('mustache-express');
const path = require('path');
const { ExpressOIDC } = require('@okta/oidc-middleware');

const templateDir = path.join(__dirname, '..', 'common', 'views');
const frontendDir = path.join(__dirname, '..', 'common', 'assets');

module.exports = function WebServer(config, extraOidcOptions, homePageTemplateName) {

  const oidc = new ExpressOIDC(Object.assign({
    issuer: config.oidc.issuer,
    client_id: config.oidc.clientId,
    client_secret: config.oidc.clientSecret,
    redirect_uri: config.oidc.redirectUri,
    scope: config.oidc.scope
  }, extraOidcOptions || {}));

  const app = express();

  app.use(session({
    secret: 'this-should-be-very-random',
    resave: true,
    saveUninitialized: true
  }));

  // Provide the configuration to the view layer because we show it on the homepage
  const displayConfig = Object.assign(
    {},
    config.oidc,
    {
      clientSecret: '****' + config.oidc.clientSecret.substr(config.oidc.clientSecret.length - 4, 4)
    }
  );

  app.locals.oidcConfig = displayConfig;

  // This server uses mustache templates located in views/ and css assets in assets/
  app.use('/assets', express.static(frontendDir));
  app.engine('mustache', mustacheExpress());
  app.set('view engine', 'mustache');
  app.set('views', templateDir);

  app.use(oidc.router);

  app.get('/', (req, res) => {
    res.send('OK');
  });

  app.get('/apps/*', oidc.ensureAuthenticated(), (req, res) => {
    res.send('Protected stuff');
  });
  
  app.get('/request', oidc.ensureAuthenticated(), (req, res) => {
    res.send(JSON.stringify(Object.keys(req)));
  });
  
  app.get('/session', oidc.ensureAuthenticated(), (req, res) => {
    res.send(JSON.stringify(session));
  });
  
  app.get('/tokens', oidc.ensureAuthenticated(), (req, res) => {
    res.send(JSON.stringify(req.userinfo));
  });

  app.get('/validate', (req, res) => {
    if (!req.isAuthenticated()) {
      res.status(401);
      res.send(null);
    } else {
      res.header("Cache-Control", "no-cache, no-store, must-revalidate");
      res.header("Pragma", "no-cache");
      res.header("Expires", 0);
      res.send("Authorized");
    }
  });

  app.get('/logout', (req, res) => {
    req.logout();
    res.redirect('/');
  });

  oidc.on('ready', () => {
    app.listen(config.port, () => console.log(`App started on port ${config.port}`));
  });

  oidc.on('error', err => {
    // An error occurred while setting up OIDC
    throw err;
  });
};
