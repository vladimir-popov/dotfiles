local u = require('feline-ex.lsp.utils')

---@type fun(table: table, prop: string | number, mock: any, test: function): any
-- Replaces a value in the {table} with a key {prop} by the {mock], and run the {test}.
-- Then restores an original value of the {table}, when the {test} is completed
-- (despite of errors), and returns thr result of the {test}.
local use_mocked_table = function(table, prop, mock, test)
    local orig = table[prop]
    table[prop] = mock
    local ok, result = pcall(test)
    table[prop] = orig
    if ok then
        return result
    else
        error(result)
    end
end

---@type fun(module: string, prop: string | number, mock: any, test: function): any
-- Replace a value in the {module} with a key {prop} by the {mock}, and run the {test}.
-- Then unload {module}, when test is completed (despite errors in the {test}).
local use_mocked_module = function(module, prop, mock, test)
    package.loaded[table] = nil
    local m = require(module)
    m[prop] = mock
    local ok, result = pcall(test)
    package.loaded[table] = nil
    if ok then
        return result
    else
        error(result)
    end
end

describe('lsp_client', function()
    it('should return the first attached to the current buffer client', function()
        -- given:
        local clients = { { name = 'first' }, { name = 'second' } }
        local mock = function()
            return clients
        end
        use_mocked_table(vim.lsp, 'buf_get_clients', mock, function()
            -- when:
            local result = u.lsp_client()

            -- then:
            assert.are.same({ name = 'first' }, result)
        end)
    end)
end)

describe('lsp_client_icon', function()
    it('should find the icon for the client by the filetype', function()
        -- given:
        local client = { config = { filetypes = { 'other_type', 'test' } } }
        local icon = { name = 'test', icon = '!' }

        -- when:
        local result = u.lsp_client_icon({ test = icon }, client)

        -- then:
        assert.are.same(icon, result)
    end)

    it('should find the icon for the first attached client', function()
        -- given:
        local client = { config = { filetypes = { 'other_type', 'test' } } }
        local icon = { name = 'test', icon = '!' }
        local mock = function()
            return { client }
        end
        use_mocked_table(vim.lsp, 'buf_get_clients', mock, function()
            -- when:
            local result = u.lsp_client_icon({ test = icon })

            -- then:
            assert.are.same(icon, result)
        end)
    end)

    it('should take an icon from the "nvim-web-devicons"', function()
        -- given:
        local client = { config = { filetypes = { 'other_type', 'test' } } }
        local icon = { name = 'test', icon = '!' }
        local mock = function()
            return { test = icon }
        end
        use_mocked_module('nvim-web-devicons', 'get_icons', mock, function()
            -- when:
            local result = u.lsp_client_icon({}, client)

            -- then:
            assert.are.same(icon, result)
        end)
    end)
end)
