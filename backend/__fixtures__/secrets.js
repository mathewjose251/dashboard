//
// SPDX-FileCopyrightText: 2020 SAP SE or an SAP affiliate company and Gardener contributors
//
// SPDX-License-Identifier: Apache-2.0
//

'use strict'

const yaml = require('js-yaml')
const createError = require('http-errors')
const { cloneDeep, merge, find, filter, has, get, set, mapValues, split, startsWith, endsWith, isEmpty } = require('lodash')
const pathToRegexp = require('path-to-regexp')
const { toBase64 } = require('./helper')
const seeds = require('./seeds')

const certificateAuthorityData = toBase64('certificate-authority-data')
const clientCertificateData = toBase64('client-certificate-data')
const clientKeyData = toBase64('client-key-data')

function getSecret ({ namespace, name, labels, data = {} }) {
  const metadata = {
    namespace,
    name
  }
  if (!isEmpty(labels)) {
    metadata.labels = labels
  }
  if (!isEmpty(data)) {
    data = mapValues(data, toBase64)
  }
  return { metadata, data }
}

function getInfrastructureSecret ({ cloudProfileName, ...options }) {
  return getSecret({
    labels: {
      'cloudprofile.garden.sapcloud.io/name': cloudProfileName
    },
    ...options
  })
}

function getKubeconfig ({ server, name = 'default' }) {
  const cluster = {
    'certificate-authority-data': certificateAuthorityData,
    server
  }
  const user = {
    'client-certificate-data': clientCertificateData,
    'client-key-data': clientKeyData
  }
  const context = {
    cluster: name,
    user: name
  }
  return yaml.safeDump({
    kind: 'Config',
    clusters: [{ cluster, name }],
    contexts: [{ context, name }],
    users: [{ user, name }],
    'current-context': name
  })
}

const infrastructureSecretList = [
  getInfrastructureSecret({
    namespace: 'garden-foo',
    name: 'secret1',
    cloudProfileName: 'infra1-profileName',
    data: {
      key: 'fooKey',
      secret: 'fooSecret'
    }
  }),
  getInfrastructureSecret({
    namespace: 'garden-foo',
    name: 'secret2',
    cloudProfileName: 'infra3-profileName',
    data: {
      key: 'fooKey',
      secret: 'fooSecret'
    }
  }),
  getInfrastructureSecret({
    namespace: 'garden-trial',
    name: 'trial-secret',
    cloudProfileName: 'infra1-profileName',
    data: {
      key: 'trialKey',
      secret: 'trialSecret'
    }
  })
]

const secrets = {
  create (options) {
    return getSecret(options)
  },
  get (namespace, name) {
    const items = secrets.list(namespace)
    return find(items, ['metadata.name', name])
  },
  list (namespace) {
    const items = cloneDeep(infrastructureSecretList)
    return namespace
      ? filter(items, ['metadata.namespace', namespace])
      : items
  },
  getShootSecret (namespace, name) {
    const shootName = name.substring(0, name.length - 11)
    const projectName = namespace.replace(/^garden-/, '')
    return getSecret({
      name,
      namespace,
      data: {
        kubeconfig: getKubeconfig({
          server: `https://api.${shootName}.${projectName}.shoot.cluster`,
          name: `shoot--${projectName}--${shootName}`
        }),
        username: `user-${projectName}-${shootName}`,
        password: `pass-${projectName}-${shootName}`
      }
    })
  },
  getSeedSecret (namespace, name) {
    const seedName = name.substring(11)
    const seed = seeds.get(seedName)
    const { type, region } = seed.spec.provider
    return getSecret({
      name,
      namespace,
      data: {
        kubeconfig: getKubeconfig({
          server: `https://api.${region}.${type}.seed.cluster`,
          name: `shoot--garden--${seedName}`
        })
      }
    })
  },
  getMonitoringSecret (namespace, name = 'monitoring-ingress-credentials') {
    const [, projectName, shootName] = split(namespace, '--')
    return getSecret({
      name,
      namespace,
      data: {
        username: `user-${projectName}-${shootName}`,
        password: `pass-${projectName}-${shootName}`
      }
    })
  },
  getServiceAccountSecret (namespace, name) {
    return getSecret({
      name,
      namespace,
      data: {
        'ca.crt': 'ca.crt',
        namespace,
        token: name
      }
    })
  }
}

const mocks = {
  list () {
    const path = '/api/v1/namespaces/:namespace/secrets'
    const match = pathToRegexp.match(path, { decode: decodeURIComponent })
    return headers => {
      const { params: { namespace } = {} } = match(headers[':path']) || {}
      const items = secrets.list(namespace)
      return Promise.resolve({ items })
    }
  },
  create ({ resourceVersion = '42' } = {}) {
    const path = '/api/v1/namespaces/:namespace/secrets'
    const match = pathToRegexp.match(path, { decode: decodeURIComponent })
    return (headers, json) => {
      const { params: { namespace } = {} } = match(headers[':path']) || {}
      const item = cloneDeep(json)
      set(item, 'metadata.namespace', namespace)
      set(item, 'metadata.resourceVersion', resourceVersion)
      return Promise.resolve(item)
    }
  },
  get () {
    const path = '/api/v1/namespaces/:namespace/secrets/:name'
    const match = pathToRegexp.match(path, { decode: decodeURIComponent })
    return headers => {
      const { params: { namespace, name } = {} } = match(headers[':path']) || {}
      const [hostname] = split(headers[':authority'], ':')
      if (hostname === 'kubernetes') {
        if (namespace === 'garden' && startsWith(name, 'seedsecret-')) {
          const item = secrets.getSeedSecret(namespace, name)
          return Promise.resolve(item)
        }
        if (endsWith(name, '.kubeconfig')) {
          const item = secrets.getShootSecret(namespace, name)
          return Promise.resolve(item)
        }
        if (/-token-[a-f0-9]{5}$/.test(name)) {
          const item = secrets.getServiceAccountSecret(namespace, name)
          return Promise.resolve(item)
        }
        const item = secrets.get(namespace, name)
        if (item) {
          return Promise.resolve(item)
        }
      } else if (endsWith(hostname, 'seed.cluster')) {
        if (name === 'monitoring-ingress-credentials') {
          const item = secrets.getMonitoringSecret(namespace, name)
          return Promise.resolve(item)
        }
      }
      return Promise.reject(createError(404))
    }
  },
  patch () {
    const path = '/api/v1/namespaces/:namespace/secrets/:name'
    const match = pathToRegexp.match(path, { decode: decodeURIComponent })
    return (headers, json) => {
      if (has(json, 'metadata.resourceVersion')) {
        return Promise.reject(createError(409))
      }
      const { params: { namespace, name } = {} } = match(headers[':path']) || {}
      const item = secrets.get(namespace, name)
      const resourceVersion = get(item, 'metadata.resourceVersion', '42')
      merge(item, json)
      set(item, 'metadata.resourceVersion', (+resourceVersion + 1).toString())
      return Promise.resolve(item)
    }
  },
  delete () {
    const path = '/api/v1/namespaces/:namespace/secrets/:name'
    const match = pathToRegexp.match(path, { decode: decodeURIComponent })
    return headers => {
      const { params: { namespace, name } = {} } = match(headers[':path']) || {}
      const item = secrets.get(namespace, name)
      return Promise.resolve(item)
    }
  }
}

module.exports = {
  ...secrets,
  mocks
}
