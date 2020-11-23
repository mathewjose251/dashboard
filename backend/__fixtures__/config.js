//
// SPDX-FileCopyrightText: 2020 SAP SE or an SAP affiliate company and Gardener contributors
//
// SPDX-License-Identifier: Apache-2.0
//

'use strict'

const { toHex, toBase64, gardenerHomeDirectory } = require('./helper')

const ca = [
  '-----BEGIN CERTIFICATE-----',
  toBase64('...'),
  '-----END CERTIFICATE-----'
].join('\n')

const configMap = new Map()

configMap.set(gardenerHomeDirectory(), {
  port: 3030,
  logLevel: 'info',
  logFormat: 'text',
  apiServerUrl: 'https://kubernetes.external.foo.bar',
  apiServerCaData: toBase64(ca),
  gitHub: {
    apiUrl: 'https://api.github.com',
    org: 'gardener',
    repository: 'ticket-dev',
    webhookSecret: toHex('webhook-secret'),
    authentication: {
      token: toHex('token')
    }
  },
  sessionSecret: toHex('session-secret'),
  oidc: {
    issuer: 'https://kubernetes:32001',
    rejectUnauthorized: true,
    ca,
    client_id: 'dashboard',
    client_secret: toHex('dashboard-secret'),
    redirect_uri: 'http://localhost:8080/auth/callback',
    scope: 'openid email profile groups audience:server:client_id:dashboard audience:server:client_id:kube-kubectl',
    clockTolerance: 42,
    public: {
      clientId: 'kube-kubectl',
      clientSecret: toHex('kube-kubectl-secret')
    }
  },
  terminal: {
    container: {
      image: 'dummyImage:1.0.0'
    },
    containerImageDescriptions: [
      {
        image: '/dummyImage:.*/',
        description: 'Dummy Image Description'
      },
      {
        image: 'fooImage:0.1.2',
        description: 'Foo Image Description'
      }
    ],
    gardenTerminalHost: {
      seedRef: 'infra1-seed'
    },
    garden: {
      operatorCredentials: {
        serviceAccountRef: {
          name: 'dashboard-terminal-admin',
          namespace: 'garden'
        }
      }
    },
    bootstrap: {
      disabled: true
    }
  },
  unreachableSeeds: {
    matchLabels: {
      'test-unreachable': 'true'
    }
  },
  frontend: {
    features: {
      terminalEnabled: true
    },
    landingPageUrl: 'https://gardener.cloud/',
    helpMenuItems: [
      {
        title: 'Getting Started',
        icon: 'description',
        url: 'https://gardener.cloud/about/'
      },
      {
        title: 'Feedback',
        icon: 'mdi-slack',
        url: 'https://kubernetes.slack.com/messages/gardener/'
      },
      {
        title: 'Issues',
        icon: 'mdi-bug',
        url: 'https://github.com/gardener/dashboard/issues/'
      }
    ]
  }
})

configMap.set('/etc/gardener/1/config.yaml', {
  port: 1234
})

configMap.set('/etc/gardener/2/config.yaml', {
  port: 1234,
  logLevel: 'info'
})

configMap.set('/etc/gardener/3/config.yaml', {
  sessionSecret: undefined
})

module.exports = {
  get (key) {
    return configMap.get(key || gardenerHomeDirectory())
  },
  list () {
    return Array.from(configMap.entries())
  }
}
