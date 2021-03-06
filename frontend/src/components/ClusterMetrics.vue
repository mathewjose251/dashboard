<!--
SPDX-FileCopyrightText: 2020 SAP SE or an SAP affiliate company and Gardener contributors

SPDX-License-Identifier: Apache-2.0
-->

<template>
  <v-list>
    <link-list-tile v-if="isAdmin"
      icon="mdi-developer-board"
      appTitle="Grafana"
      :url="grafanaUrlOperators"
      :urlText="grafanaUrlOperators"
      :isShootStatusHibernated="isShootStatusHibernated"
    ></link-list-tile>
    <link-list-tile v-else
      icon="mdi-developer-board"
      appTitle="Grafana"
      :url="grafanaUrlUsers"
      :urlText="grafanaUrlUsers"
      :isShootStatusHibernated="isShootStatusHibernated"
    ></link-list-tile>
    <link-list-tile v-if="isAdmin"
      appTitle="Prometheus"
      :url="prometheusUrl"
      :urlText="prometheusUrl"
      :isShootStatusHibernated="isShootStatusHibernated"
      content-class="pt-0"
    ></link-list-tile>
    <link-list-tile v-if="hasAlertmanager"
      appTitle="Alertmanager"
      :url="alertmanagerUrl"
      :urlText="alertmanagerUrl"
      :isShootStatusHibernated="isShootStatusHibernated"
      content-class="pt-0"
    ></link-list-tile>
    <v-divider v-show="!!username && !!password" inset></v-divider>
    <username-password v-if="isAdmin" :username="username" :password="password" :showNotAvailablePlaceholder="isSeedUnreachable">
      <template v-slot:notAvailablePlaceholder>
        <v-list-item-content>
          <v-list-item-subtitle>Operator Credentials</v-list-item-subtitle>
          <v-list-item-title class="wrap-text pt-1">
            <v-icon color="cyan darken-2">mdi-alert-circle-outline</v-icon>
            Credentials not available as the Seed {{shootSeedName}} is not reachable by the dashboard
          </v-list-item-title>
        </v-list-item-content>
      </template>
    </username-password>
    <username-password v-else :username="username" :password="password"></username-password>
  </v-list>
</template>

<script>
import get from 'lodash/get'
import UsernamePassword from '@/components/UsernamePasswordListTile'
import LinkListTile from '@/components/LinkListTile'
import { mapGetters } from 'vuex'
import { shootItem } from '@/mixins/shootItem'

export default {
  components: {
    UsernamePassword,
    LinkListTile
  },
  props: {
    shootItem: {
      type: Object,
      required: true
    }
  },
  mixins: [shootItem],
  computed: {
    ...mapGetters([
      'isAdmin'
    ]),
    grafanaUrlOperators () {
      return get(this.shootItem, 'info.grafanaUrlOperators', '')
    },
    grafanaUrlUsers () {
      return get(this.shootItem, 'info.grafanaUrlUsers', '')
    },
    prometheusUrl () {
      return get(this.shootItem, 'info.prometheusUrl', '')
    },
    alertmanagerUrl () {
      return get(this.shootItem, 'info.alertmanagerUrl', '')
    },
    username () {
      return this.isAdmin ? get(this.shootItem, 'seedInfo.monitoring_username', '') : get(this.shootItem, 'info.monitoring_username', '')
    },
    password () {
      return this.isAdmin ? get(this.shootItem, 'seedInfo.monitoring_password', '') : get(this.shootItem, 'info.monitoring_password', '')
    },
    hasAlertmanager () {
      const emailReceivers = get(this.shootItem, 'spec.monitoring.alerting.emailReceivers', [])
      return emailReceivers.length > 0
    }
  }
}
</script>

<style lang="scss" scoped>
  .wrap-text {
    white-space: normal;
  }
</style>
