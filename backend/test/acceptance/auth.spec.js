//
// SPDX-FileCopyrightText: 2020 SAP SE or an SAP affiliate company and Gardener contributors
//
// SPDX-License-Identifier: Apache-2.0
//

'use strict'

const { oidc = {} } = require('../../lib/config')
const security = require('../../lib/security')
const setCookieParser = require('set-cookie-parser')
const ZERO_DATE = new Date(0)
const OTAC = 'jd93ke'
const { COOKIE_HEADER_PAYLOAD, COOKIE_SIGNATURE, COOKIE_TOKEN } = security

class Client {
  constructor ({
    user,
    client_id: clientId,
    client_secret: clientSecret
  }) {
    this.user = user
    this.clientId = clientId
    this.clientSecret = clientSecret
  }

  authorizationUrl ({
    redirect_uri: redirectUri,
    scope
  }) {
    const url = new URL(oidc.issuer)
    url.pathname = '/auth'
    const params = url.searchParams
    params.append('client_id', this.clientId)
    params.append('redirect_uri', redirectUri)
    params.append('scope', scope)
    params.append('response_type', 'code')
    return url.toString()
  }

  async callback (redirectUri, { code }, { response_type: responseType }) {
    expect(code).toBe(OTAC)
    expect(responseType).toBe('code')
    const bearer = await this.user.bearer
    const expiresIn = Math.floor(Date.now() / 1000) + 86400
    return {
      id_token: bearer,
      expires_in: expiresIn
    }
  }
}

async function getIssuerClient (user) {
  const client = new Client({ user, ...oidc })
  client.CLOCK_TOLERANCE = oidc.clockTolerance || 30
  return client
}

module.exports = function ({ agent, sandbox, k8s, auth }) {
  /* eslint no-unused-expressions: 0 */

  const { createUser } = auth
  const username = 'foo@example.org'
  const user = createUser({ id: username })

  it('should redirect to authorization url', async function () {
    const getIssuerClientStub = sandbox.stub(security, 'getIssuerClient').callsFake(() => getIssuerClient(user))

    const res = await agent
      .get('/auth')
      .redirects(0)
      .send()

    expect(getIssuerClientStub).to.be.calledOnce
    expect(res).to.have.status(302)
    const url = new URL(res.headers.location)
    expect(url.searchParams.get('client_id')).toBe(oidc.client_id)
    expect(url.searchParams.get('redirect_uri')).toBe(oidc.redirect_uri)
    expect(url.searchParams.get('scope')).toBe(oidc.scope)
  })

  it('should fail to redirect to authorization url', async function () {
    const message = 'Issuer not available'
    const getIssuerClientStub = sandbox.stub(security, 'getIssuerClient').throws('IssuerClientError', message)

    const res = await agent
      .get('/auth')
      .redirects(0)
      .send()

    expect(getIssuerClientStub).to.be.calledOnce
    expect(res).to.have.status(302)
    expect(res).to.redirectTo(`/login#error=${encodeURIComponent(message)}`)
  })

  it('should redirect to home after successful authorization', async function () {
    const getIssuerClientStub = sandbox.stub(security, 'getIssuerClient').callsFake(() => getIssuerClient(user))
    k8s.stub.authorizeToken()

    const res = await agent
      .get(`/auth/callback?code=${OTAC}`)
      .redirects(0)
      .send()

    expect(getIssuerClientStub).to.be.calledOnce
    expect(res).to.have.status(302)
    expect(res).to.redirectTo('/')
  })

  it('should redirect to login after failed authorization', async function () {
    const getIssuerClientStub = sandbox.stub(security, 'getIssuerClient').callsFake(() => getIssuerClient(user))
    const invalidOtac = 'ic82jd'
    let message
    try {
      expect(invalidOtac).toBe(OTAC)
    } catch (err) {
      message = err.message
    }

    const res = await agent
      .get(`/auth/callback?code=${invalidOtac}`)
      .redirects(0)
      .send()

    expect(getIssuerClientStub).to.be.calledOnce
    expect(res).to.have.status(302)
    expect(res).to.redirectTo(`/login#error=${encodeURIComponent(message)}`)
  })

  it('should successfully login with a given token', async function () {
    const bearer = await user.bearer
    k8s.stub.authorizeToken()

    const res = await agent
      .post('/auth')
      .send({ token: bearer })

    expect(res).to.have.status(200)
    const {
      [COOKIE_HEADER_PAYLOAD]: cookieHeaderPayload,
      [COOKIE_SIGNATURE]: cookieSignature,
      [COOKIE_TOKEN]: cookieToken
    } = setCookieParser.parse(res, {
      decodeValues: true,
      map: true
    })
    const [header, payload] = cookieHeaderPayload.value.split('.')
    const signature = cookieSignature.value
    const encryptedBearer = cookieToken.value
    const token = [header, payload, signature].join('.')
    const tokenPayload = security.decode(token)
    expect(tokenPayload.jti).toMatch(/[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}/i)
    expect(cookieHeaderPayload.sameSite).toBe('Lax')
    expect(cookieHeaderPayload.httpOnly).toBeUndefined()
    expect(cookieSignature.sameSite).toBe('Lax')
    expect(cookieSignature.httpOnly).toBe(true)
    expect(cookieToken.sameSite).toBe('Lax')
    expect(cookieToken.httpOnly).toBe(true)
    expect(await security.verify(token)).toEqual(tokenPayload)
    expect(await security.decrypt(encryptedBearer)).toBe(bearer)
    expect(res).to.be.json
    expect(res.body.id).toBe(username)
  })

  it('should logout', async function () {
    const res = await agent
      .get('/auth/logout')
      .set('cookie', await user.cookie)
      .redirects(0)
      .send()

    expect(res).to.have.status(302)
    expect(res).to.redirectTo('/login')
    const {
      [COOKIE_HEADER_PAYLOAD]: cookieHeaderPayload,
      [COOKIE_SIGNATURE]: cookieSignature,
      [COOKIE_TOKEN]: cookieToken
    } = setCookieParser.parse(res, {
      decodeValues: true,
      map: true
    })
    expect(cookieHeaderPayload.value).toHaveLength(0)
    expect(cookieHeaderPayload.expires).toEqual(ZERO_DATE)
    expect(cookieSignature.value).toHaveLength(0)
    expect(cookieSignature.expires).toEqual(ZERO_DATE)
    expect(cookieToken.value).toHaveLength(0)
    expect(cookieToken.expires).toEqual(ZERO_DATE)
  })
}
