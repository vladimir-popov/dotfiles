local function not_(fn)
    return function(...)
        return not fn(...)
    end
end

local function one_of(...)
    local fns = { ... }
    return function(...)
        local result = false
        for _, fn in ipairs(fns) do
            if result then
                break
            end
            result = result or fn(...)
        end
        return result
    end
end

local function all_of(...)
    local fns = { ... }
    return function(...)
        local result = true
        for _, fn in ipairs(fns) do
            result = result and fn(...)
        end
        return result
    end
end

local function even(c)
    return function()
        local line = vim.api.nvim_get_current_line()
        local n = vim.fn.count(line, c)
        return n % 2 == 0
    end
end

local function previous_the_same(c)
    return function()
        local line = vim.api.nvim_get_current_line()
        local col = vim.fn.charcol('.') - 1
        return line:sub(col, col) == c
    end
end

function TMP()
   return print(not_(previous_the_same)('`')())
end

local function is_couple(c1, c2)
    return function()
        local line = vim.api.nvim_get_current_line()
        local n1 = vim.fn.count(line, c1)
        local n2 = vim.fn.count(line, c2)
        return n1 == n2
    end
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

local snippets = {
    pair('(', ')', not_(is_couple)),
    pair('{', '}', not_(is_couple)),
    pair('[', ']', not_(is_couple)),
    pair('<', '>', not_(is_couple)),
    pair("'", "'", not_(even)),
    pair('"', '"', not_(one_of(even, previous_the_same))),
    pair('`', '`', not_(previous_the_same)),
}

return _, snippets
