local get_visual = function(args, parent)
    if #parent.snippet.env.SELECT_RAW > 0 then
        return sn(nil, t(parent.snippet.env.SELECT_RAW))
    else -- If SELECT_RAW is empty, return a blank insert node
        return sn(nil, i(1))
    end
end

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
        { i(1, 'description of the tests'), d(2, get_visual) }
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
