local c = require('feline-ex.conditions')

local M = {}

---@type fun(): string
---
---@return string # the name with extension of the file from the current buffer.
M.file_name = function()
    return vim.fn.expand('%:t')
end

---@type fun(): string
---Resolves the name of the current file relative to the current working directory.
---If file is not in the one of subdirectories of the working directory, then its
---path will be returned with:
--- * prefix "/.../" in case when the file is not in the one of home subdirectories;
--- * prefix "~/" in case when the file is in one of home subdirectories.
---
---@return string # the name of the file relative to the current working directory.
M.relative_file_name = function()
    local full_name = vim.fn.expand('%:p')
    local name = vim.fn.expand('%:.')
    if name == full_name then
        name = vim.fn.expand('%:~')
    end
    if name == full_name then
        name = '/.../' .. vim.fn.expand('%:t')
    end
    return name
end

---@type fun(component: FelineComponent): string
---Cuts the current working path and gets the `opts.depth` directories from the end
---with prefix ".../". For example: inside the path `/3/2/1` this provider will return
---the string ".../2/1" for depth 2. If `opts.depth` is more then directories in the path,
---then path will be returned as is.
---
---@param component FelineComponent the current component with properties:
---* `opts.depth: number`   it will be used as a count of the last directories in the working path. Default is 2.
---
---@return string # last `opts.depth` ac count of directories of the current working path.
M.working_path = function(component)
    local full_path = vim.fn.getcwd()
    local count = component.opts and component.opts.depth or 1
    local sep = '/' -- FIXME: use system separator
    local dirs = vim.split(full_path, sep, { plain = true, trimempty = true })
    local result = '...' .. sep
    if count > #dirs then
        return full_path
    end
    if count <= 0 then
        return result
    end
    local tail = vim.list_slice(dirs, #dirs - count + 1, #dirs)
    for _, dir in ipairs(tail) do
        result = result .. dir .. sep
    end
    return result
end

---@type fun(): string
---@return string # a list of languages used to spell check or an empty string.
M.spellcheck_langs = function()
    if vim.wo.spell then
        return vim.bo.spelllang
    else
        return ''
    end
end

---@type fun(): string
---Returns the curent git branch.
---It uses `vim.fn.FugitiveHead` to take a current git branch.
---
---@return string branch a name of the current branch or empty string;
M.fugitive_branch = function()
    if c.is_git_workspace() then
        return vim.fn.FugitiveHead()
    else
        return ''
    end
end

return M
