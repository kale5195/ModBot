/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react/no-unescaped-entities */

import { Action, ruleDefinitions } from "~/lib/validations.server";
import { Rule, RuleDefinition, RuleName, SelectOption } from "~/rules/rules.type";
import { Input } from "~/components/ui/input";
import { FieldLabel, SliderField } from "~/components/ui/fields";
import { Checkbox } from "~/components/ui/checkbox";
import { Card, CardContent, CardHeader } from "~/components/ui/card";
import { Link, useFetcher } from "@remix-run/react";
import {
  Control,
  Controller,
  FormProvider,
  UseFormRegister,
  UseFormWatch,
  useFieldArray,
  useForm,
  useFormContext,
} from "react-hook-form";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Textarea } from "./ui/textarea";

import { ClientOnly } from "remix-utils/client-only";
import { CheckCircle2, X, XCircleIcon } from "lucide-react";
import { UserPicker } from "./user-picker";
import { Role, User } from "@prisma/client";
import { MoxieMemberPicker } from "./moxie-picker";
import { Avatar, AvatarImage } from "./ui/avatar";

export type FormValues = {
  id?: string;
  banThreshold?: number | null;
  excludeUsernames?: Array<SelectOption> | null;
  excludeCohosts: boolean;
  slowModeHours?: number | null;

  inclusionRuleSet: {
    id?: string;
    active: boolean;
    target: string;
    logicType: "AND" | "OR";
    ruleParsed: Array<Rule>;
    actionsParsed: Array<Action>;
  };
  exclusionRuleSet: {
    id?: string;
    active: boolean;
    target: string;
    logicType: "AND" | "OR";
    ruleParsed: Array<Rule>;
    actionsParsed: Array<Action>;
  };
};

export function RuleDisplayForm(props: {
  ruleDefinitions: typeof ruleDefinitions;
  ruleNames: readonly RuleName[];
  defaultValues: FormValues;
}) {
  const methods = useForm<FormValues>({
    defaultValues: props.defaultValues,
    shouldFocusError: false,
    criteriaMode: "all",
  });

  const { control, watch } = methods;

  return (
    <div className="w-full">
      <FormProvider {...methods}>
        <form id="channel-form" method="post" className="w-full space-y-7">
          <fieldset className="space-y-6 w-full">
            <div>
              <p className="font-semibold">Automatic Moderation Rules</p>
            </div>

            <div className="text-md flex items-start gap-2">
              <CheckCircle2 className="text-green-500 inline w-5 h-5 shrink-0 mt-1" />
              <div>
                When{" "}
                <select
                  className="p-1 bg-primary/10 rounded-md"
                  defaultValue={props.defaultValues.inclusionRuleSet.logicType}
                  disabled
                >
                  <option value="OR">any</option>
                  <option value="AND">all</option>
                </select>{" "}
                of the following rules are met, then invite the user to this channel.
              </div>
            </div>

            <div>
              <RuleSetEditor
                ruleDefinitions={ruleCategory(props.ruleDefinitions, "inclusion")}
                rulesNames={props.ruleNames}
                watch={watch}
                control={control}
                name="inclusionRuleSet.ruleParsed"
              />
            </div>
          </fieldset>

          <div className="py-6">
            <hr />
          </div>

          <fieldset className="space-y-6 w-full">
            <div className="text-md flex items-start gap-2">
              <XCircleIcon className="text-red-500 w-5 h-5 mt-1 shrink-0" />
              <div>
                Unless{" "}
                <select
                  className="p-1 bg-primary/10 rounded-md"
                  defaultValue={props.defaultValues.exclusionRuleSet.logicType}
                  disabled
                >
                  <option value="OR">any</option>
                  <option value="AND">all</option>
                </select>{" "}
                of the following rules are met, then reject the user from this channel.
              </div>
            </div>

            <div>
              <RuleSetEditor
                ruleDefinitions={ruleCategory(props.ruleDefinitions, "exclusion")}
                rulesNames={props.ruleNames}
                watch={watch}
                control={control}
                name="exclusionRuleSet.ruleParsed"
              />
            </div>
          </fieldset>
          <div className="py-6">
            <hr />
          </div>
        </form>
      </FormProvider>
    </div>
  );
}

function RuleSetEditor(props: {
  ruleDefinitions: typeof ruleDefinitions;
  rulesNames: readonly RuleName[];
  // @ts-ignore -- some build <> local ts mismatch issue theres no way im wasting more life to debug
  control: Control<FormValues, any, FormValues>;
  watch: UseFormWatch<FormValues>;
  name: "inclusionRuleSet.ruleParsed" | "exclusionRuleSet.ruleParsed";
}) {
  const { control } = props;
  const { fields: ruleFields } = useFieldArray({
    control,
    name: props.name,
  });

  return (
    <div>
      <div className="space-y-4">
        <div className="space-y-4">
          {ruleFields.map((ruleField, ruleIndex) => {
            const ruleName = props.watch(`${props.name}.${ruleIndex}.name`);

            return (
              <Card key={ruleField.id} className="w-full rounded-lg">
                <CardHeader>
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex gap-3 items-start">
                      {props.ruleDefinitions[ruleName].author !== "modbot" &&
                        props.ruleDefinitions[ruleName].authorIcon && (
                          <Avatar className="w-[33px] h-[33px] ring-white ring-4 shadow-xl shrink-0 mt-1">
                            <AvatarImage src={props.ruleDefinitions[ruleName].authorIcon} />
                          </Avatar>
                        )}
                      <div>
                        <p className="font-medium text-md">{props.ruleDefinitions[ruleName].friendlyName}</p>
                        <p className="text-gray-500 text-xs">{props.ruleDefinitions[ruleName].description}</p>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                {Object.entries(props.ruleDefinitions[ruleName].args).length > 0 && (
                  <CardContent>
                    <div className="space-y-6">
                      <RuleArgs
                        ruleDefinition={props.ruleDefinitions[ruleName]}
                        ruleIndex={ruleIndex}
                        name={props.name}
                      />
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function RuleArgs(props: {
  ruleDefinition: RuleDefinition;
  ruleIndex: number;
  name: "inclusionRuleSet.ruleParsed" | "exclusionRuleSet.ruleParsed";
}) {
  const { register, control, getValues } = useFormContext<FormValues>();
  const ruleDef = props.ruleDefinition;

  // check for if rule is currently inverted, if so change description

  return Object.entries(ruleDef.args).map(([argName, argDef]) => {
    if (argDef.type === "number") {
      const defaultValue = getValues(`${props.name}.${props.ruleIndex}.args.${argName}`);
      return (
        <FieldLabel
          key={argName}
          label={argDef.friendlyName}
          description={argDef.description}
          className="flex-col items-start"
        >
          <Input
            type="number"
            disabled
            required={argDef.required}
            placeholder={argDef.placeholder}
            defaultValue={defaultValue}
          />
        </FieldLabel>
      );
    }

    if (argDef.type === "moxieMemberFanTokenPicker") {
      return (
        <ClientOnly key={argName}>
          {() => (
            <FieldLabel label={argDef.friendlyName} description={argDef.description} className="flex-col items-start">
              <MoxieMemberPicker
                name={`${props.name}.${props.ruleIndex}.args.${argName}`}
                isMulti={false}
                required={argDef.required}
                isDisabled={true}
              />
            </FieldLabel>
          )}
        </ClientOnly>
      );
    }

    if (argDef.type === "farcasterUserPicker") {
      return (
        <ClientOnly key={argName}>
          {() => (
            <FieldLabel label={argDef.friendlyName} description={argDef.description} className="flex-col items-start">
              <UserPicker
                isDisabled={true}
                name={`${props.name}.${props.ruleIndex}.args.${argName}`}
                isMulti={false}
                required={argDef.required}
              />
            </FieldLabel>
          )}
        </ClientOnly>
      );
    }

    if (argDef.type === "farcasterUserPickerMulti") {
      return (
        <ClientOnly key={argName}>
          {() => (
            <FieldLabel
              key={argName}
              label={argDef.friendlyName}
              description={argDef.description}
              className="flex-col items-start"
            >
              <UserPicker
                name={`${props.name}.${props.ruleIndex}.args.${argName}`}
                isMulti={true}
                isDisabled={true}
                required={argDef.required}
              />
            </FieldLabel>
          )}
        </ClientOnly>
      );
    }

    if (argDef.type === "textarea") {
      return (
        <FieldLabel
          key={argName}
          label={argDef.friendlyName}
          description={argDef.description}
          className="flex-col items-start"
        >
          <Textarea
            disabled
            required={argDef.required}
            placeholder={argDef.placeholder}
            defaultValue={argDef.defaultValue as string | undefined}
            {...register(`${props.name}.${props.ruleIndex}.args.${argName}`)}
          />
        </FieldLabel>
      );
    }

    if (argDef.type === "select") {
      return (
        <FieldLabel
          key={argName}
          label={argDef.friendlyName}
          description={argDef.description}
          className="flex-col items-start"
        >
          <Controller
            name={`${props.name}.${props.ruleIndex}.args.${argName}`}
            defaultValue={argDef.defaultValue as string | undefined}
            control={control}
            render={({ field }) => (
              <Select onValueChange={field.onChange} defaultValue={field.value} required={argDef.required} disabled>
                <SelectTrigger className="w-[150px] sm:w-[200px] md:w-[400px] text-left">
                  <SelectValue placeholder={`Select a ${argDef.friendlyName.toLowerCase()}`} />
                </SelectTrigger>
                <SelectContent>
                  {argDef.options?.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                      {option.hint && <p className="text-gray-500 text-xs">{option.hint}</p>}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </FieldLabel>
      );
    }

    if (argDef.type === "string") {
      const defaultValue = getValues(`${props.name}.${props.ruleIndex}.args.${argName}`);
      return (
        <FieldLabel
          key={argName}
          label={argDef.friendlyName}
          description={argDef.description}
          className="flex-col items-start"
        >
          <Input
            disabled
            required={argDef.required}
            pattern={argDef.pattern}
            placeholder={argDef.placeholder}
            defaultValue={defaultValue}
          />
        </FieldLabel>
      );
    }
    if (argDef.type === "boolean") {
      return (
        <FieldLabel
          key={argName}
          label={argDef.friendlyName}
          className="gap-2"
          labelProps={{
            htmlFor: `ruleSet.ruleParsed.${props.ruleIndex}.args.${argName}`,
          }}
          // description={argDef.description}
          position="right"
        >
          <Controller
            control={control}
            name={`${props.name}.${props.ruleIndex}.args.${argName}`}
            defaultValue={argDef.defaultValue as boolean | undefined}
            render={({ field: { onChange, name, value } }) => (
              <Checkbox
                disabled
                id={`ruleSet.ruleParsed.${props.ruleIndex}.args.${argName}`}
                name={name}
                onCheckedChange={onChange}
                checked={value}
              />
            )}
          />
        </FieldLabel>
      );
    }
  });
}

function ruleCategory(defs: typeof ruleDefinitions, category: "inclusion" | "exclusion") {
  const out: Record<string, RuleDefinition> = {};
  Object.entries(defs).forEach(([name, def]) => {
    if (def.category === category || def.category === "all") {
      out[name] = def;
    }
  });

  return out;
}
