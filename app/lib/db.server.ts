import { PrismaClient } from "@prisma/client";

import { singleton } from "./singleton.server";
import { Action } from "./validations.server";
import { Permission } from "./permissions.server";
import { RuleSet } from "./types";
import { Rule, SelectOption } from "~/rules/rules.type";

// Hard-code a unique key, so we can look up the client when this module gets re-imported
const db = singleton("prisma", () =>
  new PrismaClient().$extends({
    result: {
      moderatedChannel: {
        inclusionRuleSetParsed: {
          needs: {
            inclusionRuleSet: true,
          },

          compute(data): (RuleSet & { ruleParsed: Rule; actionsParsed: Array<Action> }) | undefined {
            if (data.inclusionRuleSet) {
              const ruleSet = JSON.parse(data.inclusionRuleSet);
              ruleSet.ruleParsed = ruleSet.rule;
              ruleSet.actionsParsed = ruleSet.actions;
              return ruleSet;
            }
          },
        },
        castRuleSetParsed: {
          needs: {
            castRuleSet: true,
          },

          compute(data): (RuleSet & { ruleParsed: Rule; actionsParsed: Array<Action> }) | undefined {
            if (data.castRuleSet) {
              const ruleSet = JSON.parse(data.castRuleSet);
              ruleSet.ruleParsed = ruleSet.rule;
              ruleSet.actionsParsed = ruleSet.actions;
              return ruleSet;
            }
          },
        },
        exclusionRuleSetParsed: {
          needs: {
            exclusionRuleSet: true,
          },
          compute(data): (RuleSet & { ruleParsed: Rule; actionsParsed: Array<Action> }) | undefined {
            if (data.exclusionRuleSet) {
              const ruleSet = JSON.parse(data.exclusionRuleSet);
              ruleSet.ruleParsed = ruleSet.rule;
              ruleSet.actionsParsed = ruleSet.actions;
              return ruleSet;
            }
          },
        },
        excludeUsernamesParsed: {
          needs: {
            excludeUsernames: true,
          },
          compute(data): Array<SelectOption> {
            return JSON.parse(data.excludeUsernames);
          },
        },
        framesParsed: {
          needs: {
            frames: true,
          },
          compute(data): {
            bgColor: string;
          } {
            const parsed = JSON.parse(data.frames);
            parsed.bgColor = parsed?.bgColor || "#ea580c";
            return parsed;
          },
        },
      },
      role: {
        permissionsParsed: {
          needs: {
            permissions: true,
          },
          compute(data): Array<Permission["id"]> {
            return JSON.parse(data.permissions);
          },
        },
      },
    },
  })
);

export { db };
