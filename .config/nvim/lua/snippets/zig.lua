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

local format = s(
    { trig = 'format', dscr = 'Generates format function;' },
    fmta(
        [[pub fn format(self: @This(), comptime _: []const u8, _: std.fmt.FormatOptions, writer: anytype) !void {
    try writer.print("<>", .{<>});
}
<>]],
        { i(1), i(2), i(0) }
    )
)

local function nameImport(
    args,     -- text from i(2) in this example i.e. { { "456" } }
    parent,   -- parent snippet or parent node
    user_args -- user_args from opts.user_args
)
    local file_name = args[1][1]
    return string.sub(file_name, 1, #file_name - 4)
end

local import = s(
    { trig = "import", dscr = "Inserts an import with same name as the zig file" },
    {
        t('const '),
        f(nameImport, -- callback (args, parent, user_args) -> string
            { 1 },    -- node indice(s) whose text is passed to callback, i.e. i(2)
            {}        -- opts
        ),
        t(' = @import("'), i(1), t('")'), i(0)
    })


local snippets = {
    self, std, ptr_cast, logger, assert, println, format, import
}

local autosnippets = {
}

return snippets, autosnippets
