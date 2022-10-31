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
local function one_of(...)
    local factories = { ... }
    return function(...) -- factory's args
        local fargs = { ... }
        return function(...) -- condition's args
            local result = false
            for _, condition_factory in ipairs(factories) do
                if result then
                    return true
                end
                result = result or condition_factory(unpack(fargs))(...)
            end
            return result
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
local function odd(c)
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

---@type ConditionFactory
local function next_is_blank()
    return function(line_to_cursor)
        local line = vim.api.nvim_get_current_line()
        local col = #line_to_cursor + 1
        local next = line:sub(col, col)
        return #next == 0 or string.find(next, '%s') == 0
    end
end

---@type ConditionFactory
local function is_couple(c1, c2)
    return function()
        local line = vim.api.nvim_get_current_line()
        local n1 = vim.fn.count(line, c1)
        local n2 = vim.fn.count(line, c2)
        return n1 == n2
    end
end

local function fn_ignore_double_input(input)
    local line = vim.api.nvim_get_current_line()
    local col = vim.fn.charcol('.')
end

local function pair(pair_begin, pair_end, cond)
    return s({ trig = pair_begin, wordTrig = false }, {
        t({ pair_begin }),
        i(1, '', { merge_node_ext_opts = false }),
        t({ pair_end }),
    }, cond and {
        condition = cond(pair_begin, pair_end),
    })
end

---ASCII explanation of the expected behavior:
--- `^` - means start of the line
--- `|` - means the current position of the cursore
--- <initial state> => <expected result>
---Cases:
--- ^|   => ^"|"
--- ^"|" => ^""|
--- ^""| => ^"""|
--- ^|.  => ^"|.
local function quotes(quote)
    return pair(quote, quote, all_of(odd, not_(previous_the_same), next_is_blank))
end

local snippets = {
    quotes('`'),
    quotes("'"),
    quotes('"'),

    -- :| means (
    -- |: means )
    -- ^:|   => ^(|)
    -- ^(|:) => ^()|
    -- ^:|)  => ^(|)
    -- ^:|.  => ^(|.
    pair('(', ')', not_(is_couple)),
    pair('{', '}', not_(is_couple)),
    pair('[', ']', not_(is_couple)),
    pair('<', '>', not_(is_couple)),
}

return _, snippets
