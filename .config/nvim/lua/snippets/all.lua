---ASCII notation used in this script:
--- `^` - means start of the line
--- `|` - means the current position of the cursore
--- :| means input of an open brace
--- |: means input of a close brace
--- * means any symbol
--- <initial state> => <expected result>

---Explanation of the expected behavior for quotes:
--- ^|   => ^"|"
--- ^"|" => ^""|
--- ^""| => ^"""|
--- ^|*  => ^"|*
--- ^(|) => ^("|")

---Explanation of the expected behavior for parentheses:
-- ^:|   => ^(|)
-- ^(|:) => ^()|
-- ^:|)  => ^(|)
-- ^:|*  => ^(|*
-- TODO: ^:|<block of code> => ^(<block of code>)|

---@alias Condition fun(line_to_cursor: string, matched_trigger: string, captures: string[]): boolean
---@alias ConditionFactory fun(...): Condition
---@alias Composition fun(factories: ConditionFactory[]): ConditionFactory

---@type Composition
local function not_(condition_factory)
    return function(...) -- factory's args
        local condition_factory = condition_factory(...)
        return function(...) -- condition's args
            return not condition_factory(...)
        end
    end
end

---@type Composition
local function all_of(...)
    local factories = { ... }
    return function(...) -- factory's args
        local fargs = { ... }
        return function(...) -- condition's args
            local result = true
            for _, condition_factory in ipairs(factories) do
                if not result then
                    return false
                end
                result = result and condition_factory(unpack(fargs))(...)
            end
            return result
        end
    end
end

---@type ConditionFactory
local function is_couple_in_line(c1, c2)
    return function()
        local line = vim.api.nvim_get_current_line()
        local n1 = vim.fn.count(line, c1)
        local n2 = vim.fn.count(line, c2)
        return n1 == n2
    end
end

---@type ConditionFactory
local function is_odd_count_in_line(c)
    return function()
        local line = vim.api.nvim_get_current_line()
        local n = vim.fn.count(line, c)
        return n % 2 ~= 0
    end
end

---@type ConditionFactory
local function previous_the_same(c)
    return function(line_to_cursor)
        -- the -1 symbol should be is exactly expected char c,
        -- so, the previous should be at -2 position
        return line_to_cursor:sub(-2, -2) == c
    end
end

local function next_(line_to_cursor)
    local line = vim.api.nvim_get_current_line()
    if line == line_to_cursor then
        return ''
    end
    local col = #line_to_cursor + 1
    return line:sub(col, col)
end

---@type ConditionFactory
local function next_is_blank_or_bkt()
    return function(line_to_cursor)
        local next_symbol = next_(line_to_cursor)
        return next_symbol == '' or string.find(next_symbol, '[%s%]%)%}%>]') == 1
    end
end

---@type ConditionFactory
local function next_is_alphanum()
    return function(line_to_cursor)
        local next_symbol = next_(line_to_cursor)
        return next_symbol == '' or string.find(next_symbol, '%w') == 1
    end
end

local function ignore_double_input(pair_close)
    return s({ trig = pair_close, wordTrig = false, priority = 900 }, { t('') }, {
        condition = function(line_to_cursor)
            local next = next_(line_to_cursor)
            return line_to_cursor:sub(-1, -1) == next
        end,
    })
end

local function pair(pair_open, pair_close, cond)
    return s({ trig = pair_open, wordTrig = false, priority = 1000 }, {
        t({ pair_open }),
        i(1, '', { merge_node_ext_opts = false }),
        t({ pair_close }),
    }, cond and {
        condition = cond(pair_open, pair_close),
    })
end

local function quotes(quote)
    return {
        ignore_double_input(quote),
        pair(
            quote,
            quote,
            all_of(is_odd_count_in_line, not_(previous_the_same), not_(next_is_alphanum))
        ),
    }
end

local function parentheses(open, close)
    return {
        ignore_double_input(close),
        pair(open, close, all_of(not_(is_couple_in_line), not_(next_is_alphanum))),
    }
end

local function flatten(...)
    local result = {}
    for _, ts in ipairs({ ... }) do
        for _, t in ipairs(ts) do
            table.insert(result, t)
        end
    end
    return result
end

local snippets = flatten(
    quotes("'"),
    quotes('"'),
    quotes('`'),
    parentheses('{', '}'),
    parentheses('[', ']'),
    parentheses('(', ')'),
    parentheses('<', '>')
)

return _, snippets
