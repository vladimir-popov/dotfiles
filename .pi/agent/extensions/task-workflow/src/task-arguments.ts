type Argument = { value: string; quoted: boolean };

/** Parse task command arguments, retaining whether each value was quoted. */
export function parseArguments(input: string): Argument[] {
  const args: Argument[] = [];
  let index = 0;
  while (index < input.length) {
    while (/\s/.test(input[index] || "") && index < input.length) index++;
    if (index >= input.length) break;
    const quote =
      input[index] === '"' || input[index] === "'" ? input[index++] : undefined;
    const start = index;
    if (quote) {
      while (index < input.length && input[index] !== quote) index++;
      if (index >= input.length)
        throw new Error("Unclosed quote in /task arguments.");
      const value = input.slice(start, index++);
      if (index < input.length && !/\s/.test(input[index]))
        throw new Error("Separate quoted /task arguments with spaces.");
      args.push({ value, quoted: true });
    } else {
      while (index < input.length && !/\s/.test(input[index])) {
        if (input[index] === '"' || input[index] === "'")
          throw new Error("Quote the entire task ID when it contains spaces.");
        index++;
      }
      args.push({ value: input.slice(start, index), quoted: false });
    }
  }
  return args;
}
