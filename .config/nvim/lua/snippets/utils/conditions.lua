local M = {}

---@type fun(line_to_cursor: string): char
local function next_symbol(line_to_cursor)
    local line = vim.api.nvim_get_current_line()
    if line == line_to_cursor then
        return ''
    end
    local col = #line_to_cursor + 1
    return line:sub(col, col)
end

---@type ConditionFactory
M.is_odd_count_in_line = function (c)
    return function()
        local line = vim.api.nvim_get_current_line()
        local n = vim.fn.count(line, c)
        return n % 2 ~= 0
    end
end

---@type ConditionFactory
M.is_couple_in_line = function(c1, c2)
    return function()
        local line = vim.api.nvim_get_current_line()
        local n1 = vim.fn.count(line, c1)
        local n2 = vim.fn.count(line, c2)
        return n1 == n2
    end
end

---@type ConditionFactory
M.previous_the_same = function(c)
    return function(line_to_cursor)
        -- the -1 symbol should be is exactly expected char c,
        -- so, the previous should be at -2 position
        return line_to_cursor:sub(-2, -2) == c
    end
end

---@type ConditionFactory
M.next_is_blank_or_bkt = function()
    return function(line_to_cursor)
        local next_symbol = next_symbol(line_to_cursor)
        return next_symbol == '' or string.find(next_symbol, '[%s%]%)%}%>]') == 1
    end
end

---@type ConditionFactory
M.next_is_alphanum = function()
    return function(line_to_cursor)
        local next_symbol = next_symbol(line_to_cursor)
        return next_symbol == '' or string.find(next_symbol, '[%w-+]') == 1
    end
end

return M
