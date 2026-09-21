// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import App from './App'

/**
 * Дымовой тест всей связки. Цифры проверяются в src/model — здесь важно,
 * что приложение поднимается, считает немедленно и переживает битый URL.
 */

function setSearch(search: string): void {
  window.history.replaceState(null, '', `/${search}`)
}

beforeEach(() => {
  setSearch('')
  localStorage.clear()
})

afterEach(cleanup)

describe('приложение', () => {
  it('поднимается и показывает сводку до всех форм', () => {
    const { container } = render(<App />)

    const verdict = container.querySelector('.verdict')
    expect(verdict).not.toBeNull()

    // Сводка стоит сразу после шапки и раньше любой формы.
    const header = container.querySelector('header.top')!
    const firstForm = container.querySelector('section.b')!
    expect(header.compareDocumentPosition(verdict!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(verdict!.compareDocumentPosition(firstForm) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

    // Доходности посчитаны без нажатия кнопки «Рассчитать».
    const values = within(verdict as HTMLElement).getAllByText(/%$/)
    expect(values.length).toBeGreaterThanOrEqual(2)
    expect(screen.queryByRole('button', { name: /рассчитать/i })).toBeNull()
  })

  it('поднимает состояние из URL', () => {
    setSearch('?v=1&s=2026-09-21&h=36&r=1&m=s&p=m0~14&b=f~%D0%A4%D0%BB%D0%BE%D1%83~100~4~1.5~0~0~1')
    render(<App />)
    expect(screen.getAllByDisplayValue('Флоу').length).toBe(1)
  })

  it('битый URL не роняет приложение', () => {
    setSearch('?v=1&p=!!!&b=???&h=нет')
    const { container } = render(<App />)
    expect(container.querySelector('.verdict')).not.toBeNull()
    expect(container.querySelectorAll('.vcell').length).toBeGreaterThan(0)
  })

  it('правка ставки пересчитывает сводку немедленно и пишется в URL', () => {
    const { container } = render(<App />)
    const before = (container.querySelector('.vcell .v') as HTMLElement).textContent

    const rateInput = screen.getAllByLabelText('ключевая ставка')[0] as HTMLInputElement
    fireEvent.change(rateInput, { target: { value: '20' } })

    expect((container.querySelector('.vcell .v') as HTMLElement).textContent).not.toBe(before)
    expect(window.location.search).toContain('m0~20')
  })

  it('цена ноль не применяется и помечается ошибкой', () => {
    const { container } = render(<App />)
    const price = screen.getAllByLabelText('Цена, % номинала')[0] as HTMLInputElement
    const before = (container.querySelector('.vcell .v') as HTMLElement).textContent

    fireEvent.change(price, { target: { value: '0' } })

    expect(price.getAttribute('aria-invalid')).toBe('true')
    expect(screen.getByText('цена должна быть больше нуля')).toBeTruthy()
    expect((container.querySelector('.vcell .v') as HTMLElement).textContent).toBe(before)
  })

  it('точку траектории можно переключить между датой и сдвигом', () => {
    render(<App />)
    const rows = screen.getAllByRole('group', { name: 'вид привязки' })
    const first = within(rows[0] as HTMLElement)

    fireEvent.click(first.getByRole('button', { name: 'дата' }))
    expect(screen.getAllByLabelText('дата заседания').length).toBeGreaterThan(0)

    fireEvent.click(first.getByRole('button', { name: 'через N мес.' }))
    expect(screen.getAllByLabelText('месяцев от старта').length).toBeGreaterThan(0)
  })

  it('переключение вида привязки сохраняет позицию точки', () => {
    setSearch('?v=1&s=2026-09-21&h=36&r=1&m=s&p=m0~14;m18~10&b=f~A~100~4~1.5~0~0~1')
    render(<App />)

    const rows = screen.getAllByRole('group', { name: 'вид привязки' })
    const second = within(rows[1] as HTMLElement)

    // сдвиг 18 месяцев → дата того же месяца, а не дата старта
    fireEvent.click(second.getByRole('button', { name: 'дата' }))
    const dateInput = screen.getByLabelText('дата заседания') as HTMLInputElement
    expect(dateInput.value).toBe('2028-03-21')

    // и обратно в тот же месяц
    fireEvent.click(second.getByRole('button', { name: 'через N мес.' }))
    const offsets = screen.getAllByLabelText('месяцев от старта') as HTMLInputElement[]
    expect(offsets[1]!.value).toBe('18')
  })

  it('бумаги добавляются и удаляются', () => {
    render(<App />)
    const countCards = () => document.querySelectorAll('.card h3 input.name').length
    const before = countCards()

    fireEvent.click(screen.getByRole('button', { name: 'Добавить флоатер' }))
    expect(countCards()).toBe(before + 1)

    const removers = screen.getAllByRole('button', { name: /^удалить / })
    fireEvent.click(removers[removers.length - 1]!)
    expect(countCards()).toBe(before)
  })

  it('генератор сетки заменяет траекторию обычными строками', () => {
    render(<App />)
    const before = screen.getAllByLabelText('ключевая ставка').length

    fireEvent.click(screen.getByRole('button', { name: 'Заменить траекторию' }))
    const after = screen.getAllByLabelText('ключевая ставка')
    expect(after.length).not.toBe(before)
    // строки остаются редактируемыми
    fireEvent.change(after[1]!, { target: { value: '11' } })
    expect((after[1] as HTMLInputElement).value).toBe('11')
  })

  it('годовой купон из ссылки доезжает до выпадающего списка', () => {
    // раньше разбор URL пропускал freq=1, а в списке такого пункта не было,
    // и select оставался без выбранного значения
    setSearch('?v=1&s=2026-09-21&h=36&r=1&m=s&p=m0~14&b=x~%D0%A4~99~1~0~0~15.5~2')
    render(<App />)
    const freq = screen.getByLabelText('Купонов в год') as HTMLSelectElement
    expect(freq.value).toBe('1')
  })

  it('недописанная дата не утаскивает точку в месяц 0', () => {
    setSearch('?v=1&s=2026-09-21&h=36&r=1&m=s&p=m0~14;2027-06-18~10&b=f~A~100~4~1.5~0~0~1')
    const { container } = render(<App />)
    const before = (container.querySelector('.vcell .v') as HTMLElement).textContent

    const dateInput = screen.getByLabelText('дата заседания') as HTMLInputElement
    fireEvent.change(dateInput, { target: { value: '' } })

    // точка выпадает из траектории целиком, а не переезжает в начало
    expect(screen.getByText('дата не задана')).toBeTruthy()
    expect(container.querySelector('.verdict')).not.toBeNull()

    // дозаполнили — точка вернулась, результат снова тот же
    fireEvent.change(dateInput, { target: { value: '2027-06-18' } })
    expect((container.querySelector('.vcell .v') as HTMLElement).textContent).toBe(before)
  })

  it('добавленная точка встаёт за самой поздней, а не за последней строкой', () => {
    // строки нарочно не по возрастанию месяца
    setSearch('?v=1&s=2026-09-21&h=60&r=1&m=s&p=m0~14;m40~9;m6~12&b=f~A~100~4~1.5~0~0~1')
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'Добавить точку' }))

    const offsets = screen.getAllByLabelText('месяцев от старта') as HTMLInputElement[]
    expect(offsets.map((i) => i.value)).toEqual(['0', '40', '6', '46'])

    // ставка списана у самой поздней точки (9), а не у последней строки (12)
    const rates = screen.getAllByLabelText('ключевая ставка') as HTMLInputElement[]
    expect(rates[3]!.value).toBe('8.5')
  })

  it('дисклеймер виден постоянно', () => {
    render(<App />)
    expect(screen.getByText(/не является инвестиционной рекомендацией/i)).toBeTruthy()
  })

  it('тема переключается атрибутом data-theme', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'тёмная' }))
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    fireEvent.click(screen.getByRole('button', { name: 'авто' }))
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false)
  })
})
