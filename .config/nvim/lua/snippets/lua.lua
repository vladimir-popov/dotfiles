local local_variable = s(
    { trig = 'll', dscr = 'Creates a new local variable.' },
    fmta('local <> = <>', { i(1, 'name'), i(2, 'value') })
)

local describe_section = s(
    'describe',
    fmta(
        [[describe('<>', function()
    <>
end)]],
        { i(1, 'description of the tests'), i(0) }
    )
)

local it_section = s(
    'it',
    fmta(
        [[it('<>', function()
    <>
end)]],
        { i(1, 'description of the test case'), i(0) }
    )
)

local snippets = { local_variable, describe_section, it_section }

return snippets
