local mock = require('luassert.mock')

local c = require('snippets.utils.conditions')

describe('is_odd_count_in_line', function()
    local api

    before_each(function()
        api = mock(vim.api, true)
    end)

    after_each(function()
        mock.revert(api)
    end)

    local cond = c.is_odd_count_in_line('!')

    it('should return true', function()
        api.nvim_get_current_line.returns('--!--')
        assert(cond())
    end)

    it('should return false', function()
        api.nvim_get_current_line.returns('!--!')
        assert(not cond())
    end)
end)

describe('is_couple_in_line', function()
    local api

    before_each(function()
        api = mock(vim.api, true)
    end)

    after_each(function()
        mock.revert(api)
    end)

    local cond = c.is_couple_in_line('<', '>')

    it('should return true for < -- >', function()
        api.nvim_get_current_line.returns('< -- >')
        assert(cond())
    end)

    it('should return true for > -- <', function() --- ???
        api.nvim_get_current_line.returns('> -- <')
        assert(cond())
    end)

    it('should return false for <--', function()
        api.nvim_get_current_line.returns('<--')
        assert(not cond())
    end)

    it('should return false for <><--', function()
        api.nvim_get_current_line.returns('<><--')
        assert(not cond())
    end)
end)

describe('previous_the_same', function()
    local cond = c.previous_the_same('!')
    it('should return true, coz pnault symbol is the same', function()
        assert(cond('!!'))
    end)
    it('should return false, coz penult symbol is not the same', function()
        assert(not cond('?!'))
    end)
end)

describe('next_is_blank_or_bkt', function()
    local api

    before_each(function()
        api = mock(vim.api, true)
    end)

    after_each(function()
        mock.revert(api)
    end)

    local cond = c.next_is_blank_or_bkt()

    it('should return true for the end of line', function()
        local current_line = 'a'
        local line_to_cursor = 'a'
        api.nvim_get_current_line.returns(current_line)
        assert(cond(line_to_cursor))
    end)

    it('should return true before one of ])}>', function()
        local current_line = 'a]b)c}d>'
        api.nvim_get_current_line.returns(current_line)
        assert(cond('a'))
        assert(cond('a]b'))
        assert(cond('a]b)c'))
        assert(cond('a]b)c}d'))
    end)
end)

describe('next_is_alphanum', function()
    local api

    before_each(function()
        api = mock(vim.api, true)
    end)

    after_each(function()
        mock.revert(api)
    end)

    local cond = c.next_is_alphanum()

    it('should return true for the end of line', function()
        local current_line = 'a'
        local line_to_cursor = 'a'
        api.nvim_get_current_line.returns(current_line)
        assert(cond(line_to_cursor))
    end)

    it('should return true before alphabet', function()
        local current_line = 'abcd'
        api.nvim_get_current_line.returns(current_line)
        assert(cond(''))
        assert(cond('a'))
        assert(cond('ab'))
    end)

    it('should return true before number', function()
        local current_line = '1 -2 +3'
        api.nvim_get_current_line.returns(current_line)
        assert(cond(''), 'before number')
        assert(cond('1 '), 'before negative number')
        assert(cond('1 -2 '), 'before +number')
    end)
end)
