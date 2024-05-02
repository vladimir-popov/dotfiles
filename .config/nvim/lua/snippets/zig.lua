local Self = s(
    { trig = 'constself' },
    fmta(
        [[const Self = @This()<>]],
        { i(0) }
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
    Self,
}

local autosnippets = {
    println,
}

return snippets, autosnippets
