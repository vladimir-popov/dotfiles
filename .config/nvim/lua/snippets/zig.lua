local self = s(
    { trig = 'selfconst' },
    fmta(
        [[const <> = @This()<>]],
        { i(1, "Self"), i(0) }
    )
)

local std = s(
    { trig = 'import_std' },
    fmta(
        [[const std = @import("std");<>]],
        { i(0) }
    )
)

local ptr_cast = s(
    { trig = 'ptrCast' },
    fmta(
        [[@ptrCast(@alignCast(<>))<>]],
        { i(1, "ptr"), i(0) }
    )
)

local println = s(
    { trig = 'println', dscr = 'Generates std.debug.print("\n", .{});' },
    fmta(
        [[std.debug.print("<>\n", .{<>});<>]],
        { i(1), i(2), i(0) }
    )
)

local assert = s('assert', t('std.debug.assert'))

local logger = s(
    { trig = 'logger', dscr = 'Generates std.log.scoped(<>);' },
    fmta(
        [[const log = std.log.scoped(<>);<>]],
        { i(1), i(0) }
    )
)

local format =  s(
    { trig = 'format', dscr = 'Generates format function;' },
    fmta(
        [[pub fn format(self: @This(), comptime _: []const u8, _: std.fmt.FormatOptions, writer: anytype) !void {
    try writer.print("<>", .{<>});
}
<>]],
        { i(1), i(2), i(0) }
    )
)


local snippets = {
    self, std, ptr_cast, logger, assert, println, format
}

local autosnippets = {
}

return snippets, autosnippets
