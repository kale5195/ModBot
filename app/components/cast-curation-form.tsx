/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react/no-unescaped-entities */
import { Action, actionDefinitions, ruleDefinitions } from "~/lib/validations.server";

import { Input } from "~/components/ui/input";
import { FieldLabel, SliderField } from "~/components/ui/fields";
import { Link, useFetcher } from "@remix-run/react";
import { Switch } from "~/components/ui/switch";
import { Controller, FormProvider, useForm } from "react-hook-form";

import { Button } from "./ui/button";

import { ClientOnly } from "remix-utils/client-only";

import { ArrowUpRight, CheckCircle2, Loader } from "lucide-react";
import { UserPicker } from "./user-picker";
import { Role, User } from "@prisma/client";
import { RuleName, Rule, SelectOption, RuleDefinition } from "~/rules/rules.type";
import RuleSetEditor, { FormValues } from "~/components/rule-editor";

function prepareFormValues(data: FormValues) {
  function transformRuleSet(ruleSet: FormValues["castRuleSet"]) {
    if (ruleSet.logicType === "AND") {
      const rule: Rule = {
        name: "and",
        type: "LOGICAL",
        args: {},
        operation: "AND",
        conditions: ruleSet.ruleParsed,
      };

      return {
        ...ruleSet,
        rule,
        ruleParsed: rule,
      };
    } else {
      const rule: Rule = {
        name: "or",
        type: "LOGICAL",
        args: {},
        operation: "OR",
        conditions: ruleSet.ruleParsed,
      };

      return {
        ...ruleSet,
        rule,
        ruleParsed: rule,
      };
    }
  }

  const tx = {
    ...data,
    excludeUsernames: data.excludeUsernames || [],
    castRuleSet: transformRuleSet(data.castRuleSet),
  };

  return tx;
}
export function CastCurationForm(props: {
  user: User;
  actionDefinitions: typeof actionDefinitions;
  ruleDefinitions: typeof ruleDefinitions;
  ruleNames: readonly RuleName[];
  defaultValues: FormValues;
  bypassInstallLink: string;
  cohostRole?: Role | null;
}) {
  const fetcher = useFetcher();
  const methods = useForm<FormValues>({
    defaultValues: props.defaultValues,
    shouldFocusError: false,
    criteriaMode: "all",
  });

  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { isSubmitting },
  } = methods;

  const onSubmit = (data: FormValues) => {
    const tx = prepareFormValues(data);
    fetcher.submit(tx, {
      encType: "application/json",
      method: "post",
    });
  };

  return (
    <div className="w-full">
      <FormProvider {...methods}>
        <form id="channel-form" method="post" className="w-full space-y-6" onSubmit={handleSubmit(onSubmit)}>
          <div className="py-6">
            <hr />
          </div>
          <fieldset disabled={isSubmitting} className="space-y-6 w-full">
            <div className="text-md flex items-start gap-2">
              <CheckCircle2 className="text-green-500 inline w-5 h-5 shrink-0 mt-1" />
              <div>
                When <span className="p-1 bg-primary/10 rounded-md">any</span> of the following rules are met, then hide
                the cast.
              </div>
            </div>

            <div>
              <RuleSetEditor
                user={props.user}
                actionDefinitions={props.actionDefinitions}
                ruleDefinitions={ruleCategory(props.ruleDefinitions)}
                rulesNames={props.ruleNames}
                watch={watch}
                control={control}
                register={register}
                name="castRuleSet.ruleParsed"
              />
            </div>
          </fieldset>

          <div className="py-6">
            <hr />
          </div>
          <fieldset disabled={isSubmitting} className="space-y-6">
            <div>
              <p className="font-medium">Slow Mode</p>
              <p className="text-gray-500 text-sm">Limit how often members can cast in the channel.</p>
            </div>

            <FieldLabel
              label="Cooldown Period"
              description="Example: Let's say you enter 2 hours, if a user's cast is posted at 9:00 PM, any additional casts until 11:00 PM will be hidden. Affects root casts only, replies cannot be moderated."
              className="flex-col items-start"
            >
              <div className="flex items-center">
                <Input
                  className="w-full sm:max-w-[100px] rounded-r-none border-r-0"
                  type="number"
                  placeholder="0"
                  {...register("slowModeHours")}
                />
                <p className="flex text-sm h-9 px-3 py-[7px] bg-gray-100 text-gray-600 border border-gray-200 rounded-md rounded-l-none">
                  Hours
                </p>
              </div>
            </FieldLabel>
          </fieldset>

          <div className="py-6">
            <hr />
          </div>
          <fieldset disabled={isSubmitting} className="space-y-6">
            <div>
              <p className="font-medium">Bypass</p>
              <p className="text-gray-500 text-sm">
                Users in this list will always have their casts appear in the channel, with no cooldown.
              </p>
              <p className="text-primary text-sm"> (Channel Moderators bypass by default, no need to add them here)</p>
            </div>

            <ClientOnly>
              {() => (
                <FieldLabel
                  labelProps={{
                    className: "w-full",
                  }}
                  label={
                    <div className="flex justify-between gap-4 w-full">
                      <p className="font-medium flex-auto">Farcaster Usernames</p>
                    </div>
                  }
                  description=""
                  className="flex-col items-start w-full"
                >
                  <UserPicker name="excludeUsernames" isMulti={true} />
                </FieldLabel>
              )}
            </ClientOnly>
          </fieldset>

          <div className="py-6">
            <hr />
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <Button type="submit" size={"lg"} className="w-full" disabled={fetcher.state !== "idle"}>
              {fetcher.state !== "idle" ? (
                <Loader className="w-4 h-4 animate-spin" />
              ) : props.defaultValues.id ? (
                "Update"
              ) : (
                "Create"
              )}
            </Button>
          </div>
        </form>
      </FormProvider>
    </div>
  );
}
function ruleCategory(defs: typeof ruleDefinitions) {
  const out: Record<string, RuleDefinition> = {};
  Object.entries(defs).forEach(([name, def]) => {
    if (def.category === "cast") {
      out[name] = def;
    }
  });

  return out;
}
