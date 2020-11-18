//
// SPDX-FileCopyrightText: 2020 SAP SE or an SAP affiliate company and Gardener contributors
//
// SPDX-License-Identifier: Apache-2.0
//

'use strict'

const express = require('express')
const { extend } = require('@gardener-dashboard/request')
const logger = require('../logger')
const { decodeBase64 } = require('../utils')
const { isHttpError } = require('@gardener-dashboard/request')
const { dashboardClient } = require('@gardener-dashboard/kube-client')
const { version } = require('../../package')

const router = module.exports = express.Router()

router.route('/')
  .get(async (req, res, next) => {
    try {
      const gardenerVersion = await fetchGardenerVersion()
      res.send({ version, gardenerVersion })
    } catch (err) {
      next(err)
    }
  })

async function fetchGardenerVersion () {
  try {
    const {
      spec: {
        service,
        caBundle
      }
    } = await dashboardClient['apiregistration.k8s.io'].apiservices.get('v1beta1.core.gardener.cloud')
    const client = extend({
      prefixUrl: `https://${service.name}.${service.namespace}`,
      ca: decodeBase64(caBundle),
      resolveBodyOnly: true,
      responseType: 'json'
    })
    const version = await client.request('version')
    return version
  } catch (err) {
    logger.warn(`Could not fetch gardener version. Error: ${err.message}`)
    return undefined
  }
}
