local Self = s(
    { trig = 'selfconst' },
    fmta(
        [[const <> = @This()<>]],
        { i(1, "Self"), i(0) }
    )
)

local STD = s(
    { trig = 'import_std' },
    fmta(
        [[const std = @import("std");<>]],
        { i(0) }
    )
)

local PTR_CAST = s(
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

local snippets = {
    Self, STD, PTR_CAST
}

local autosnippets = {
    println,
}

return snippets, autosnippets
