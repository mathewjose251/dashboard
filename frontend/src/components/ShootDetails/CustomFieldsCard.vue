<!--
SPDX-FileCopyrightText: 2020 SAP SE or an SAP affiliate company and Gardener contributors

SPDX-License-Identifier: Apache-2.0
-->

<template>
  <v-card v-if="customFields">
    <v-toolbar flat dark dense color="cyan darken-2">
      <v-toolbar-title class="subtitle-1">Custom Fields</v-toolbar-title>
    </v-toolbar>
    <v-list>
      <template v-for="(customField, index) in customFields" >
        <v-divider v-if="index !== 0" inset :key="`${customField.key}-divider`"></v-divider>
        <v-list-item :key="customField.key">
          <v-list-item-icon>
            <v-icon color="cyan darken-2" v-if="customField.icon">{{customField.icon}}</v-icon>
          </v-list-item-icon>
          <v-list-item-content>
            <v-list-item-subtitle>{{customField.name}}</v-list-item-subtitle>
            <v-list-item-title class="pt-1">
              <v-tooltip top v-if="customField.tooltip">
                <template v-slot:activator="{ on }">
                  <span v-on="on">{{customField.value}}</span>
                </template>
                {{customField.tooltip}}
              </v-tooltip>
              <span v-else>{{customField.value}}</span>
            </v-list-item-title>
          </v-list-item-content>
        </v-list-item>
      </template>
    </v-list>
  </v-card>
</template>

<script>

export default {
  name: 'custom-fields-card',
  props: {
    customFields: {
      type: Array
    }
  }
}
</script>
