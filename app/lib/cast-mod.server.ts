import { Cast } from "@neynar/nodejs-sdk/build/neynar-api/v2";
import { ModeratedChannel, ModerationLog } from "@prisma/client";

import { Rule, User } from "~/rules/rules.type";
import { ruleFunctions } from "~/lib/validations.server";

export type ValidateCastArgs = {
  moderatedChannel: ModeratedChannel & { castRuleSetParsed: { ruleParsed: Rule } };
  cast: Cast;
};

export async function validateCast({ moderatedChannel, cast }: ValidateCastArgs) {
  const result = await evaluateRules(moderatedChannel, cast, moderatedChannel.castRuleSetParsed.ruleParsed);
  return result;
}

async function evaluateRules(
  moderatedChannel: ModeratedChannel,
  cast: Cast,
  rule: Rule
): Promise<{
  passedRule: boolean;
  explanation: string;
  rule: Rule;
}> {
  if (rule.type === "CONDITION") {
    return evaluateRule(moderatedChannel, cast, rule);
  } else if (rule.type === "LOGICAL" && rule.conditions) {
    if (rule.operation === "AND") {
      const evaluations = await Promise.all(
        rule.conditions.map((subRule) => evaluateRules(moderatedChannel, cast, subRule))
      );
      if (evaluations.every((e) => e.passedRule)) {
        return {
          passedRule: true,
          explanation: `${evaluations.map((e) => e.explanation).join(", ")}`,
          rule,
        };
      } else {
        const failure = evaluations.find((e) => !e.passedRule)!;
        return { passedRule: false, explanation: `${failure.explanation}`, rule };
      }
    } else if (rule.operation === "OR") {
      const results: Array<{
        passedRule: boolean;
        explanation: string;
        rule: Rule;
      }> = [];

      for (const subRule of rule.conditions) {
        const result = await evaluateRules(moderatedChannel, cast, subRule);
        results.push(result);
        if (result.passedRule) {
          return result;
        }
      }

      const explanation =
        results.length > 1
          ? `Failed all checks: ${results.map((e) => e.explanation).join(", ")}`
          : results[0].explanation;

      return {
        passedRule: false,
        explanation,
        rule,
      };
    }
  }

  return { passedRule: false, explanation: "No rules", rule };
}

async function evaluateRule(
  channel: ModeratedChannel,
  cast: Cast,
  rule: Rule
): Promise<{ passedRule: boolean; explanation: string; rule: Rule }> {
  const check = ruleFunctions[rule.name];
  if (!check) {
    throw new Error(`No function for rule ${rule.name}`);
  }

  const result = await check({ channel, user: {} as unknown as User, cast, rule });

  return {
    passedRule: result.result,
    explanation: result.message,
    rule,
  };
}
