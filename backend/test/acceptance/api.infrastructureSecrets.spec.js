// SPDX-FileCopyrightText: 2020 SAP SE or an SAP affiliate company and Gardener contributors
//
// SPDX-License-Identifier: Apache-2.0

'use strict'

const _ = require('lodash')
const { pick } = _
const { mockRequest } = require('@gardener-dashboard/request')
const fixtures = require('../../__fixtures__')

describe('api', function () {
  let agent

  beforeAll(() => {
    agent = createAgent()
  })

  afterAll(() => {
    return agent.close()
  })

  beforeEach(() => {
    mockRequest.mockReset()
  })

  describe('infrastructureSecrets', function () {
    const namespace = 'garden-foo'
    const name = 'foo-infra3'
    const secretBinding = fixtures.infrastructure.secretBindings.get(namespace, name)
    // project
    const project = fixtures.projects.getByNamespace(namespace)
    // user
    const id = project.spec.owner
    const user = fixtures.auth.createUser({ id })
    // cloudProfile
    const cloudProfileName = secretBinding.metadata.labels['cloudprofile.garden.sapcloud.io/name']

    it('should return three infrastructure secrets', async function () {
      mockRequest.mockImplementationOnce(fixtures.auth.mocks.reviewSelfSubjectAccess())
      mockRequest.mockImplementationOnce(fixtures.infrastructure.secrets.mocks.list())
      mockRequest.mockImplementationOnce(fixtures.infrastructure.secretBindings.mocks.list())

      const res = await agent
        .get(`/api/namespaces/${namespace}/infrastructure-secrets`)
        .set('cookie', await user.cookie)
        .expect('content-type', /json/)
        .expect(200)

      expect(mockRequest).toBeCalledTimes(3)
      expect(mockRequest.mock.calls).toMatchSnapshot()

      expect(res.body).toMatchSnapshot()
    })

    it('should return no infrastructure secrets', async function () {
      const namespace = 'garden-baz'

      mockRequest.mockImplementationOnce(fixtures.auth.mocks.reviewSelfSubjectAccess())
      mockRequest.mockImplementationOnce(fixtures.infrastructure.secrets.mocks.list())
      mockRequest.mockImplementationOnce(fixtures.infrastructure.secretBindings.mocks.list())

      const res = await agent
        .get(`/api/namespaces/${namespace}/infrastructure-secrets`)
        .set('cookie', await user.cookie)
        .expect('content-type', /json/)
        .expect(200)

      expect(mockRequest).toBeCalledTimes(3)
      expect(mockRequest.mock.calls).toMatchSnapshot()

      expect(res.body).toMatchSnapshot()
    })

    it('should create a infrastructure secret', async function () {
      const metadata = {
        name: 'new-infra1',
        cloudProfileName
      }
      const data = {
        key: 'myKey',
        secret: 'mySecret'
      }

      mockRequest.mockImplementationOnce(fixtures.infrastructure.secrets.mocks.create())
      mockRequest.mockImplementationOnce(fixtures.infrastructure.secretBindings.mocks.create())
      mockRequest.mockImplementationOnce(fixtures.auth.mocks.reviewSelfSubjectAccess())

      const res = await agent
        .post(`/api/namespaces/${namespace}/infrastructure-secrets`)
        .set('cookie', await user.cookie)
        .send({ metadata, data })
        .expect('content-type', /json/)
        .expect(200)

      expect(mockRequest).toBeCalledTimes(3)
      expect(mockRequest.mock.calls).toMatchSnapshot()

      expect(res.body).toMatchSnapshot()
    })

    it('should patch an own infrastructure secret', async function () {
      const data = {
        key: 'myKey',
        secret: 'mySecret'
      }

      mockRequest.mockImplementationOnce(fixtures.infrastructure.secretBindings.mocks.get())
      mockRequest.mockImplementationOnce(fixtures.infrastructure.secrets.mocks.patch())
      mockRequest.mockImplementationOnce(fixtures.auth.mocks.reviewSelfSubjectAccess())

      const res = await agent
        .put(`/api/namespaces/${namespace}/infrastructure-secrets/${name}`)
        .set('cookie', await user.cookie)
        .send({ data })
        .expect('content-type', /json/)
        .expect(200)

      expect(mockRequest).toBeCalledTimes(3)
      expect(mockRequest.mock.calls).toMatchSnapshot()

      expect(res.body).toMatchSnapshot()
    })

    it('should not patch a shared infrastructure secret', async function () {
      const name = 'trial-infra1'

      mockRequest.mockImplementationOnce(fixtures.infrastructure.secretBindings.mocks.get())

      const res = await agent
        .put(`/api/namespaces/${namespace}/infrastructure-secrets/${name}`)
        .set('cookie', await user.cookie)
        .send({ data: {} })
        .expect('content-type', /json/)
        .expect(422)

      expect(mockRequest).toBeCalledTimes(1)
      expect(mockRequest.mock.calls).toMatchSnapshot()

      expect(res.body).toMatchSnapshot({
        details: expect.any(Object)
      })
    })

    it('should delete an own infrastructure secret', async function () {
      mockRequest.mockImplementationOnce(fixtures.infrastructure.secretBindings.mocks.get())
      mockRequest.mockImplementationOnce(fixtures.shoots.mocks.list())
      mockRequest.mockImplementationOnce(fixtures.infrastructure.secretBindings.mocks.delete())
      mockRequest.mockImplementationOnce(fixtures.infrastructure.secrets.mocks.delete())

      const res = await agent
        .delete(`/api/namespaces/${namespace}/infrastructure-secrets/${name}`)
        .set('cookie', await user.cookie)
        .expect('content-type', /json/)
        .expect(200)

      expect(mockRequest).toBeCalledTimes(4)
      expect(mockRequest.mock.calls).toMatchSnapshot()

      expect(res.body).toMatchSnapshot()
    })

    it('should not delete a shared infrastructure secret', async function () {
      const name = 'trial-infra1'

      mockRequest.mockImplementationOnce(fixtures.infrastructure.secretBindings.mocks.get())

      const res = await agent
        .delete(`/api/namespaces/${namespace}/infrastructure-secrets/${name}`)
        .set('cookie', await user.cookie)
        .expect('content-type', /json/)
        .expect(422)

      expect(mockRequest).toBeCalledTimes(1)
      expect(mockRequest.mock.calls).toMatchSnapshot()

      expect(res.body).toMatchSnapshot({
        details: expect.any(Object)
      })
    })

    it('should not delete infrastructure secret if referenced by shoot', async function () {
      const name = 'foo-infra1'

      mockRequest.mockImplementationOnce(fixtures.infrastructure.secretBindings.mocks.get())
      mockRequest.mockImplementationOnce(fixtures.shoots.mocks.list())

      const res = await agent
        .delete(`/api/namespaces/${namespace}/infrastructure-secrets/${name}`)
        .set('cookie', await user.cookie)
        .expect('content-type', /json/)
        .expect(422)

      expect(mockRequest).toBeCalledTimes(2)
      expect(mockRequest.mock.calls).toMatchSnapshot()

      expect(res.body).toMatchSnapshot({
        details: expect.any(Object)
      })
    })
  })
})
