import type { Chat, Options } from "./types";

const DEFAULTS: Options = {
  font_name: "emojiV1",
  font_size: 36,
  margin: 4,
  outline: 2,
  displayed_time: 8,
};

const WIDTH = 1280;
const HEIGHT = 720;

const HEADER = `\
[Script Info]
ScriptType: v4.00+
PlayResX: ${WIDTH}
PlayResY: ${HEIGHT}
WrapStyle: 2
ScaledBorderAndShadow: Yes
Timing: 100.0000
\
`;

const EVENTS_HEADER = `\

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\
`;

const build_style = function (opt: Options) {
  const style = {
    Name: "style",
    Fontname: opt.font_name,
    Fontsize: opt.font_size,
    PrimaryColour: "&H00FFFFFF",
    SecondaryColour: "&H00FFFFFF",
    OutlineColour: "&H80000000",
    BackColour: "&H00000000",
    Bold: -1,
    Italic: 0,
    Underline: 0,
    StrikeOut: 0,
    ScaleX: 100,
    ScaleY: 100,
    Spacing: 0,
    Angle: 0,
    BorderStyle: 1,
    Outline: opt.outline,
    Shadow: 0,
    Alignment: 7,
    MarginL: 0,
    MarginR: 0,
    MarginV: 0,
    Encoding: 1,
  };

  return `\
[V4+ Styles]
Format: ${Object.keys(style).join(", ")}
Style: ${Object.values(style).join(",")}\
`;
};

const collision_at_start = function (first: Chat, second: Chat, opt: Options) {
  const len = first.message.length * opt.font_size;
  const speed = (WIDTH + len) / (opt.displayed_time * 100);
  const time = second.vpos - first.vpos;
  const first_pos_when_second_starts = speed * time;
  const margin = opt.font_size / 2;
  return len + margin - first_pos_when_second_starts;
};

const collision_at_end = function (first: Chat, second: Chat, opt: Options) {
  const first_ends_at = first.vpos + opt.displayed_time * 100;
  const len = second.message.length * opt.font_size;
  const speed = (WIDTH + len) / (opt.displayed_time * 100);
  const time = first_ends_at - second.vpos;
  const second_pos_when_first_ends = speed * time;
  return second_pos_when_first_ends - WIDTH;
};

const collision = function (
  first: Chat | null | undefined,
  second: Chat,
  opt: Options
) {
  if (!first) {
    return 0;
  }
  if (!second) {
    return 0;
  }
  const start = collision_at_start(first, second, opt);
  const end = collision_at_end(first, second, opt);
  if (start > end) {
    return start;
  } else {
    return end;
  }
};

const to_hms = function (t: number) {
  const zerofill = (x: number) => ("0" + x).substr(-2);
  const ss = zerofill(t % 100);
  t = Math.floor(t / 100);
  const s = zerofill(t % 60);
  t = Math.floor(t / 60);
  const m = zerofill(t % 60);
  const h = Math.floor(t / 60);
  return `${h}:${m}:${s}.${ss}`;
};

const build_events = function (list: Chat[], opt: Options) {
  const lineheight = opt.font_size + opt.margin * 2;
  const n_normal_rows = Math.floor((HEIGHT + opt.margin) / lineheight);
  const n_wrap_rows = Math.floor(
    (HEIGHT + opt.margin - lineheight / 2) / lineheight
  );
  const n_rows = n_normal_rows + n_wrap_rows;
  const item_in_row: (Chat | null)[] = Array.from(
    { length: n_rows },
    () => null
  );
  return list
    .map(function (item, index) {
      let row = 0;
      let min_collision = Infinity;
      for (let i = 0; i < n_rows; i++) {
        const c = collision(item_in_row[i], item, opt);
        if (c <= 0) {
          row = i;
          break;
        }
        if (c < min_collision) {
          min_collision = c;
          row = i;
        }
      }

      item_in_row[row] = item;

      const start = to_hms(item.vpos);
      const end = to_hms(item.vpos + opt.displayed_time * 100);
      const len = item.message.length * opt.font_size;
      const x0 = WIDTH;
      const x1 = -len;
      const y =
        row < n_normal_rows
          ? opt.margin + row * (opt.font_size + opt.margin * 2)
          : lineheight / 2 +
            opt.margin +
            (row - n_normal_rows) * (opt.font_size + opt.margin * 2);
      const effect = `{\\move(${x0},${y},${x1},${y})}`;

      return (
        "Dialogue: " +
        [
          index,
          start,
          end,
          "style",
          item.user_id.replace(",", "_"),
          "0000",
          "0000",
          "0000",
          "",
          `${effect}${item.message}`,
        ].join(",")
      );
    })
    .join("\n");
};

const build = function (list: Chat[], options?: Record<string, any>) {
  const opt = { ...DEFAULTS, ...options };
  return [
    HEADER,
    build_style(opt),
    EVENTS_HEADER,
    build_events(list, opt),
  ].join("\n");
};

export { build, DEFAULTS };
