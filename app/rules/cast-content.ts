import { Cast, CastId } from "@neynar/nodejs-sdk/build/neynar-api/v2";
import RE2 from "re2";
import emojiRegex from "emoji-regex";
import { detect } from "tinyld";
import { CheckFunction, CheckFunctionArgs, Rule, RuleDefinition } from "~/rules/rules.type";
import mimeType from "mime-types";
import { languages } from "~/lib/languages";
import { neynar } from "~/lib/neynar.server";

function tryParseUrl(url: string) {
  try {
    return new URL(url);
  } catch (e) {
    return undefined;
  }
}

// Rule: contains text, option to ignore case
function containsText(args: CheckFunctionArgs) {
  const { cast, rule } = args as { cast: Cast; rule: Rule };
  const { searchText, caseSensitive } = rule.args;

  const text = caseSensitive ? cast.text : cast.text.toLowerCase();
  const search = caseSensitive ? searchText : searchText.toLowerCase();

  const result = text.includes(search);
  return {
    result,
    message: result ? `Cast contains "${searchText}"` : `Cast does not contain "${searchText}"`,
  };
}
async function containsEmbeds(args: CheckFunctionArgs) {
  const { cast, rule } = args as { cast: Cast; rule: Rule };
  const { images, videos, frames, links, casts, domain } = rule.args;

  const checkForEmbeds: string[] = [];
  images && checkForEmbeds.push("image");
  videos && checkForEmbeds.push("video");
  frames && checkForEmbeds.push("frame");
  links && checkForEmbeds.push("link");
  casts && checkForEmbeds.push("casts");

  let embedsFound: string[] = [];
  const embedTypesFound: string[] = [];

  const foundCasts = cast.embeds.filter((embed): embed is { cast_id: CastId } => {
    return "cast_id" in embed;
  });

  if (foundCasts.length > 0) {
    embedTypesFound.push("casts");
    embedsFound = embedsFound.concat(foundCasts.map((c) => c.cast_id.hash));
  }

  const knownImageCdnHostnames = ["imagedelivery.net", "imgur.com"];
  // even if not specified in args we always search for
  // images and videos because they may only be filtering
  // for `link` embeds in which case these need to be
  // ruled out. its also free and fast.
  const foundImages = cast.embeds.filter((embed): embed is { url: string } => {
    if ("url" in embed) {
      const url = tryParseUrl(embed.url);
      if (!url) {
        return false;
      }

      if (domain && !embed.url.includes(domain)) {
        return false;
      }

      const mime = mimeType.lookup(embed.url);
      return (mime && mime.startsWith("image")) || knownImageCdnHostnames.includes(url.hostname);
    } else {
      return false;
    }
  });

  if (foundImages.length > 0) {
    embedTypesFound.push("image");
    embedsFound = embedsFound.concat(foundImages.map((i) => i.url));
  }

  const foundVideos = cast.embeds.filter((embed): embed is { url: string } => {
    if ("url" in embed) {
      if (domain && !embed.url.includes(domain)) {
        return false;
      }

      const mime = mimeType.lookup(embed.url);
      return !!mime && (mime.startsWith("video") || mime.startsWith("application/vnd.apple.mpegurl"));
    } else {
      return false;
    }
  });

  if (foundVideos.length > 0) {
    embedTypesFound.push("video");
    embedsFound = embedsFound.concat(foundVideos.map((i) => i.url));
  }

  // if either is specified we need to fetch the cast
  // since a frame_url looks just like a link url.
  // its debatable whether you'd ever want to filter
  // on this but so it goes..
  if (links || frames) {
    const rsp = await neynar.fetchBulkCasts([cast.hash]);
    const castWithInteractions = rsp.result.casts[0];

    if (!castWithInteractions) {
      throw new Error(`Cast not found. Should be impossible. hash: ${cast.hash}`);
    }

    if (castWithInteractions.frames && castWithInteractions.frames.length > 0) {
      let frames = [...castWithInteractions.frames];
      if (domain) {
        frames = frames.filter((f) => f.frames_url.includes(domain));
      }

      if (frames.length > 0) {
        embedTypesFound.push("frame");
        embedsFound = embedsFound.concat(frames.map((f) => f.frames_url) || []);
      }
    }

    const remainingUrls = castWithInteractions.embeds.filter((e): e is { url: string } => {
      if ("url" in e) {
        if (domain && !e.url.includes(domain)) {
          return false;
        }
        return !embedsFound.includes(e.url);
      } else {
        return false;
      }
    });

    if (remainingUrls.length > 0) {
      embedTypesFound.push("link");
      embedsFound = embedsFound.concat(remainingUrls.map((i) => i.url));
    }
  }

  const violatingEmbeds = checkForEmbeds.filter((embedType) => embedTypesFound.includes(embedType));
  const result = violatingEmbeds.length > 0;

  const domainMessage = domain ? ` from ${domain}` : "";
  return {
    result,
    message: result
      ? `Cast contains ${violatingEmbeds.join(", ")}` + domainMessage
      : `Cast doesn't contain ${checkForEmbeds.join(", ")}` + domainMessage,
  };
}

function castLength(args: CheckFunctionArgs) {
  const { cast, rule } = args as { cast: Cast; rule: Rule };
  const { min, max } = rule.args as { min?: number; max?: number };

  if (min) {
    if (cast.text.length > min) {
      return {
        result: false,
        message: `Cast is greater than ${min} characters`,
      };
    }
  }

  if (max) {
    if (cast.text.length < max) {
      return {
        result: false,
        message: `Cast is less than ${max} characters`,
      };
    }
  }

  return {
    result: true,
    message: "Cast is within length limits",
  };
}
function textMatchesPattern(args: CheckFunctionArgs) {
  const { cast, rule } = args as { cast: Cast; rule: Rule };
  const { pattern, caseInsensitive } = rule.args;

  const re2 = new RE2(pattern, caseInsensitive ? "i" : "");
  const isMatch = re2.test(cast.text);

  return {
    result: isMatch,
    message: isMatch ? `Cast matches pattern ${pattern}` : `Cast does not match pattern ${pattern}`,
  };
}
function textMatchesLanguage(args: CheckFunctionArgs) {
  const { cast, rule } = args as { cast: Cast; rule: Rule };
  const { language } = rule.args;

  if (!cast.text.length) {
    return {
      result: false,
      message: "Language detection is not available for empty casts.",
    };
  }

  try {
    new URL(cast.text);
    return {
      result: false,
      message: "URLs are not supported for language detection.",
    };
  } catch (e) {
    // not a url
  }

  const regex = emojiRegex();
  const withoutEmojis = cast.text.replaceAll(regex, "");

  if (cast.text.length < 20) {
    // model not reliable here
    return {
      result: true,
      message: "Language detection is not reliable for short casts.",
    };
  }

  const isLanguage = detect(withoutEmojis, { only: [language] }) !== "";
  return {
    result: isLanguage,
    message: isLanguage ? `Cast is in ${language}` : `Cast is not in ${language}`,
  };
}

function containsTooManyMentions(args: CheckFunctionArgs) {
  const { cast, rule } = args as { cast: Cast; rule: Rule };
  const { maxMentions } = rule.args;

  const mentions = cast.text.match(/@\w+/g) || [];

  const result = mentions.length > maxMentions;

  return {
    result,
    message: result ? `Too many mentions. Max is ${maxMentions}` : `Mentions are within limits`,
  };
}

function containsLinks(args: CheckFunctionArgs) {
  const { cast, rule } = args as { cast: Cast; rule: Rule };
  const maxLinks = rule.args.maxLinks || 0;
  const regex = /https?:\/\/\S+/gi;
  const matches = cast.text.match(regex) || [];

  const result = matches.length > maxLinks;
  return {
    result,
    message: result ? `Too many links. Max is ${maxLinks}` : `Links are within limits`,
  };
}

type RuleName =
  | "containsText"
  | "containsEmbeds"
  | "textMatchesPattern"
  | "textMatchesLanguage"
  | "castLength"
  | "containsTooManyMentions"
  | "containsLinks";

export const castContentRulesFunction: Record<RuleName, CheckFunction> = {
  containsText: containsText,
  containsEmbeds: containsEmbeds,
  textMatchesPattern: textMatchesPattern,
  textMatchesLanguage: textMatchesLanguage,
  castLength: castLength,
  containsTooManyMentions: containsTooManyMentions,
  containsLinks: containsLinks,
};
export const castContentRulesDefinitions: Record<RuleName, RuleDefinition> = {
  containsText: {
    name: "containsText",
    author: "modbot",
    authorUrl: "https://modbot.sh",
    authorIcon: `/icons/modbot.png`,
    allowMultiple: true,
    category: "cast",
    friendlyName: "Contains Text",
    checkType: "cast",
    description: "Check if the text contains a specific string",
    hidden: false,
    invertable: true,
    args: {
      searchText: {
        type: "string",
        friendlyName: "Search Text",
        description: "The text to search for",
      },
      caseSensitive: {
        type: "boolean",
        friendlyName: "Case Sensitive",
        description: "If checked, 'abc' is different from 'ABC'",
      },
    },
  },
  containsEmbeds: {
    name: "containsEmbeds",
    author: "modbot",
    authorUrl: "https://modbot.sh",
    authorIcon: `/icons/modbot.png`,
    allowMultiple: true,
    category: "cast",
    friendlyName: "Contains Embedded Content",
    checkType: "cast",
    description: "Check if the cast contains images, gifs, videos, frames or links",
    hidden: false,
    invertable: true,
    args: {
      images: {
        type: "boolean",
        defaultValue: true,
        friendlyName: "Images",
        description: "Check for images or gifs",
      },
      videos: {
        type: "boolean",
        defaultValue: true,
        friendlyName: "Videos",
        description: "Check for videos",
      },
      frames: {
        type: "boolean",
        defaultValue: true,
        friendlyName: "Frames",
        description: "Check for frames",
      },
      links: {
        type: "boolean",
        defaultValue: true,
        friendlyName: "Links",
        description: "Check for links",
      },
      casts: {
        type: "boolean",
        defaultValue: true,
        friendlyName: "Casts",
        description: "Check for quote casts",
      },
      domain: {
        type: "string",
        friendlyName: "Domain",
        placeholder: "e.g. glass.com",
        description:
          "Check for embeds from a specific domain. Example: if you check 'Frames' and add glass.com, this check will trigger for frames from glass.com.",
      },
    },
  },
  textMatchesPattern: {
    name: "textMatchesPattern",
    author: "modbot",
    authorUrl: "https://modbot.sh",
    authorIcon: `/icons/modbot.png`,
    allowMultiple: true,
    category: "cast",
    friendlyName: "Matches Pattern (Regex)",
    checkType: "cast",
    description: "Check if the text matches a specific pattern",
    hidden: false,
    invertable: true,
    args: {
      pattern: {
        type: "string",
        friendlyName: "Pattern",
        required: true,
        description: "The regular expression to match against. No leading or trailing slashes.",
      },
      caseInsensitive: {
        type: "boolean",
        friendlyName: "Ignore Case",
        description: "If checked, 'abc' is the same as 'ABC'",
      },
    },
  },
  textMatchesLanguage: {
    name: "textMatchesLanguage",
    author: "modbot",
    authorUrl: "https://modbot.sh",
    authorIcon: `/icons/modbot.png`,
    allowMultiple: true,
    category: "cast",
    friendlyName: "Matches Language",
    checkType: "cast",
    description: "Check if the text matches a specific language",
    invertedDescription: "Check if the text is any language *but* the one specified.",
    hidden: true,
    invertable: true,
    args: {
      language: {
        type: "select",
        friendlyName: "Language",
        description: "The language to check for",
        options: languages.map((l) => ({
          label: l.name,
          value: l.code,
        })),
      },
    },
  },
  castLength: {
    name: "castLength",
    author: "modbot",
    authorUrl: "https://modbot.sh",
    authorIcon: `/icons/modbot.png`,
    allowMultiple: false,
    category: "cast",
    friendlyName: "Cast Length",
    checkType: "cast",
    description: "Check if the cast length is within a range",
    hidden: false,
    invertable: false,
    args: {
      min: {
        type: "number",
        friendlyName: "Less than",
        description: "Setting a value of 5 would trigger this rule if the length was 0 to 4 characters.",
      },
      max: {
        type: "number",
        friendlyName: "More than",
        description: "Setting a value of 10 would trigger this rule if the length was 11 or more characters.",
      },
    },
  },

  containsTooManyMentions: {
    name: "containsTooManyMentions",
    author: "modbot",
    authorUrl: "https://modbot.sh",
    authorIcon: `/icons/modbot.png`,
    allowMultiple: false,
    category: "cast",
    friendlyName: "Contains Mentions",
    checkType: "cast",
    description: "Check if the text contains a certain amount of mentions",
    invertable: true,
    hidden: false,
    args: {
      maxMentions: {
        type: "number",
        required: true,
        friendlyName: "Max Mentions",
        placeholder: "0",
        description: "The maximum number of mentions allowed",
      },
    },
  },
  containsLinks: {
    name: "containsLinks",
    author: "modbot",
    authorUrl: "https://modbot.sh",
    authorIcon: `/icons/modbot.png`,
    allowMultiple: false,
    category: "cast",
    friendlyName: "Contains Links",
    checkType: "cast",
    description: "Check if the text contains any links",
    hidden: false,
    invertable: true,
    args: {
      maxLinks: {
        type: "number",
        friendlyName: "Max Links",
        description: "The maximum number of links allowed",
      },
    },
  },
};
