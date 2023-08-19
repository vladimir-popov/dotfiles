local get_visual = function(args, parent)
	if #parent.snippet.env.SELECT_RAW > 0 then
		return sn(nil, t(parent.snippet.env.SELECT_RAW))
	else -- If SELECT_RAW is empty, return a blank insert node
		return sn(nil, i(1))
	end
end

local local_variable = s(
	{ trig = "ll", dscr = "Creates a new local variable." },
	fmta("local <> = <>", { i(1, "name"), i(0, "value") })
)

local local_function = s(
	{ trig = "lf", dscr = "Creates a new local function." },
	fmta(
		[[local function <>(<>)
    <>
end]],
		{ i(1, "name"), i(2), i(0) }
	)
)

local funn = s(
	{ trig = "fun ", dscr = "Creates a new anonymous function." },
	fmta(
		[[function(<>)
    <>
end]],
		{ i(1), i(0) }
	)
)

local module_function = s(
	{ trig = "fun.", descr = "Creates a new method for module." },
	fmta(
		[[function <>.<>(<>)
    <>
end]],
		{
			i(1, "M"),
			i(2, "function_name"),
			i(3),
			i(0),
		}
	)
)

local method = s(
	{ trig = "fun:", descr = "Creates a new method for class." },
	fmta(
		[[function <>:<>(<>)
    <>
end]],
		{
			i(1, "ClassName"),
			i(2, "method_name"),
			i(3),
			i(0),
		}
	)
)

local pretty_print = s(
	{ trig = "pp", descr = "Create invocation of the vim.pretty_print" },
	fmta([[vim.pretty_print(<>)]], { i(0, "object") })
)

local aclass = s("-cl", t("---@class "))
local afield = s("-fi", t("---@field "))
local areturn = s("-re", t("---@return "))
local aparameter = s("-pa", t("---@param "))
local aprivate = s("-pri", t("---@private"))
local aprotected = s("-pro", t("---@protected"))

local log = s("log", fmta([[local log = require('plenary.log').new({ plugin = '<>' })]], { i(1, "Plugin name") }))

local describe_section = s(
	"des",
	fmta(
		[[describe('<>', function()
    <>
end)]],
		{ i(1, "description of the tests"), d(2, get_visual) }
	)
)

local it_section = s(
	"it",
	fmta(
		[[it('<>', function()
    <>
end)]],
		{ i(1, "description of the test case"), i(0) }
	)
)

local snippets = { log, describe_section, it_section }
local autosnippets = {
	funn,
	local_variable,
	local_function,
	module_function,
	method,
	pretty_print,
	aclass,
	afield,
	areturn,
	aparameter,
	aprivate,
	aprotected,
}

return snippets, autosnippets
