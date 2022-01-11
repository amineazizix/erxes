import {
  ApolloGateway,
  GatewayConfig,
  RemoteGraphQLDataSource,
  GraphQLDataSourceProcessOptions,
} from "@apollo/gateway";
import { ServiceEndpointDefinition } from "@apollo/gateway/src/config";
import express from "express";
import * as dotenv from "dotenv";
dotenv.config();
import { GraphQLRequestContext, GraphQLResponse } from "apollo-server-core";
import { ValueOrPromise } from "apollo-server-types";
import splitCookiesString from "./util/splitCookiesString";

export interface GatewayContext {
  req?: express.Request & { user?: any };
  res?: express.Response;
}

interface SubgraphConfig {
  [x: string]: string;
}

export const allSubgraphConfigs: SubgraphConfig = {
    "api" : "SUBGRAPH_API_URL",
    "engages" : "SUBGRAPH_ENGAGES_URL",
    "inbox": "SUBGRAPH_INBOX_URL"
};

function getConfiguredServices(): ServiceEndpointDefinition[] {
  const configuredServices: ServiceEndpointDefinition[] = [];

  for (const subgraphName of Object.keys(allSubgraphConfigs)) {
    const envVarName = allSubgraphConfigs[subgraphName];
    const url = process.env[envVarName];

    // this subgraph's url is not configured in environment variables
    if (!url) continue;

    configuredServices.push({
      name: subgraphName,
      url,
    });
  }

  return configuredServices;
}

class CookieHeaderPassingDataSource extends RemoteGraphQLDataSource<
  GatewayContext
> {
  didReceiveResponse({
    response,
    context,
  }: Required<
    Pick<
      GraphQLRequestContext<GatewayContext>,
      "request" | "response" | "context"
    >
  >): ValueOrPromise<GraphQLResponse> {
    // This means gateway is starting up and didn't recieve request from clients
    if (!context.res) return response;

    const setCookiesCombined = response.http?.headers.get("set-cookie");

    const setCookiesArr = splitCookiesString(setCookiesCombined);

    for (const setCookie of setCookiesArr || []) {
      context.res.append("Set-Cookie", setCookie);
    }
    return response;
  }

  willSendRequest({
    request,
    context,
  }: GraphQLDataSourceProcessOptions<GatewayContext>): ValueOrPromise<void> {
    // This means gateway is starting up and didn't recieve request from clients
    if (!("req" in context) || !context.req) {
      return;
    }

    if (context.req.user) {
      const userJson = JSON.stringify(context.req.user);
      const userJsonBase64 = Buffer.from(userJson, 'utf8').toString('base64');
      request.http?.headers.set("user", userJsonBase64);
    }

    const cookie = context.req?.headers.cookie;
    if (!cookie) return;

    if (typeof cookie === "string") {
      request.http?.headers.set("Cookie", cookie);
      return;
    }
  }
}

export function createGateway(): ApolloGateway {
  const gatewayConfig: GatewayConfig = {
    serviceList: getConfiguredServices(),
    buildService: (definition: ServiceEndpointDefinition) => {
      return new CookieHeaderPassingDataSource(definition);
    },
  };

  if (process.env.NODE_ENV === "development") {
    gatewayConfig.experimental_pollInterval = 5 * 1000;
  }

  const gateway = new ApolloGateway(gatewayConfig);

  return gateway;
}
