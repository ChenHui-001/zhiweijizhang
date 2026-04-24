/**
 * Jest global type declarations
 * Used when @types/jest is not available in the compilation context
 */

declare function describe(name: string, fn: () => void): void;
declare function it(name: string, fn: () => void | Promise<void>): void;
declare function test(name: string, fn: () => void | Promise<void>): void;
declare function expect(actual: any): jest.Matchers<void>;
declare function beforeEach(fn: () => void | Promise<void>): void;
declare function afterEach(fn: () => void | Promise<void>): void;
declare function beforeAll(fn: () => void | Promise<void>): void;
declare function afterAll(fn: () => void | Promise<void>): void;

declare namespace jest {
  function fn<T extends (...args: any[]) => any>(implementation?: T): Mock<T>;
  function clearAllMocks(): void;
  function resetAllMocks(): void;
  function restoreAllMocks(): void;
  function mock(moduleName: string, factory?: () => any): void;
  function useFakeTimers(): void;
  function useRealTimers(): void;
  function advanceTimersByTime(ms: number): void;
  function runAllTimers(): void;

  type Mock<T extends (...args: any[]) => any = (...args: any[]) => any> = {
    (...args: Parameters<T>): ReturnType<T>;
    mockReturnValue(value: ReturnType<T>): Mock<T>;
    mockReturnValueOnce(value: ReturnType<T>): Mock<T>;
    mockResolvedValue(value: Awaited<ReturnType<T>>): Mock<T>;
    mockResolvedValueOnce(value: Awaited<ReturnType<T>>): Mock<T>;
    mockRejectedValue(value: any): Mock<T>;
    mockRejectedValueOnce(value: any): Mock<T>;
    mockImplementation(fn: T): Mock<T>;
    mockImplementationOnce(fn: T): Mock<T>;
    mockClear(): Mock<T>;
    mockReset(): Mock<T>;
    mockRestore(): Mock<T>;
    getMockName(): string;
    mockName(name: string): Mock<T>;
    mock: {
      calls: Parameters<T>[];
      instances: ReturnType<T>[];
      results: { type: 'return' | 'throw'; value: any }[];
      lastCall: Parameters<T>;
      invocationCallOrder: number[];
    };
  };

  type MockedFunction<T extends (...args: any[]) => any> = Mock<T>;

  type Mocked<T> = {
    [P in keyof T]: T[P] extends (...args: any[]) => any
      ? MockedFunction<T[P]>
      : T[P];
  };

  type MockedClass<T extends new (...args: any[]) => any> = Mocked<T> & {
    prototype: Mocked<InstanceType<T>>;
  };

  interface Matchers<R> {
    toBe(expected: any): R;
    toEqual(expected: any): R;
    toStrictEqual(expected: any): R;
    toBeDefined(): R;
    toBeUndefined(): R;
    toBeNull(): R;
    toBeTruthy(): R;
    toBeFalsy(): R;
    toBeGreaterThan(expected: number): R;
    toBeGreaterThanOrEqual(expected: number): R;
    toBeLessThan(expected: number): R;
    toBeLessThanOrEqual(expected: number): R;
    toBeCloseTo(expected: number, precision?: number): R;
    toMatch(expected: string | RegExp): R;
    toMatchObject(expected: any): R;
    toContain(expected: any): R;
    toContainEqual(expected: any): R;
    toHaveLength(expected: number): R;
    toHaveProperty(keyPath: string, value?: any): R;
    toBeInstanceOf(expected: any): R;
    toThrow(expected?: string | Error | RegExp): R;
    toThrowError(expected?: string | Error | RegExp): R;
    toHaveBeenCalled(): R;
    toHaveBeenCalledTimes(expected: number): R;
    toHaveBeenCalledWith(...args: any[]): R;
    toHaveBeenLastCalledWith(...args: any[]): R;
    toHaveBeenNthCalledWith(n: number, ...args: any[]): R;
    toHaveReturned(): R;
    toHaveReturnedTimes(expected: number): R;
    toHaveReturnedWith(expected: any): R;
    toHaveLastReturnedWith(expected: any): R;
    toHaveNthReturnedWith(n: number, expected: any): R;
    not: Matchers<R>;
    resolves: Matchers<Promise<R>>;
    rejects: Matchers<Promise<R>>;
    toBeInTheDocument(): R;
    toHaveTextContent(text: string | RegExp): R;
    toHaveClass(...classNames: string[]): R;
    toHaveAttribute(attr: string, value?: any): R;
    toBeVisible(): R;
    toBeDisabled(): R;
    toBeEnabled(): R;
    toBeEmpty(): R;
    toContainElement(element: HTMLElement | null): R;
    toContainHTML(html: string): R;
    toHaveFocus(): R;
    toHaveFormValues(expectedValues: Record<string, any>): R;
    toHaveStyle(css: string | Record<string, any>): R;
  }
}

declare module '@testing-library/react' {
  import { ReactElement } from 'react';

  export interface RenderOptions {
    container?: HTMLElement;
    baseElement?: HTMLElement;
    hydrate?: boolean;
    wrapper?: React.ComponentType<{ children: React.ReactNode }>;
    queries?: any;
  }

  export interface RenderResult {
    container: HTMLElement;
    baseElement: HTMLElement;
    debug: (element?: HTMLElement | HTMLElement[]) => void;
    unmount: () => void;
    rerender: (ui: ReactElement) => void;
    asFragment: () => DocumentFragment;
    getByText: (text: string | RegExp) => HTMLElement;
    getByRole: (role: string, options?: any) => HTMLElement;
    getByTestId: (testId: string) => HTMLElement;
    getByPlaceholderText: (text: string | RegExp) => HTMLElement;
    getByLabelText: (text: string | RegExp) => HTMLElement;
    getByDisplayValue: (value: string | RegExp) => HTMLElement;
    getByAltText: (text: string | RegExp) => HTMLElement;
    getByTitle: (title: string | RegExp) => HTMLElement;
    queryByText: (text: string | RegExp) => HTMLElement | null;
    queryByRole: (role: string, options?: any) => HTMLElement | null;
    queryByTestId: (testId: string) => HTMLElement | null;
    queryByPlaceholderText: (text: string | RegExp) => HTMLElement | null;
    queryByLabelText: (text: string | RegExp) => HTMLElement | null;
    queryByDisplayValue: (value: string | RegExp) => HTMLElement | null;
    queryByAltText: (text: string | RegExp) => HTMLElement | null;
    queryByTitle: (title: string | RegExp) => HTMLElement | null;
    findAllByText: (text: string | RegExp) => Promise<HTMLElement[]>;
    findByText: (text: string | RegExp) => Promise<HTMLElement>;
    findByRole: (role: string, options?: any) => Promise<HTMLElement>;
    findByTestId: (testId: string) => Promise<HTMLElement>;
    getAllByText: (text: string | RegExp) => HTMLElement[];
    getAllByRole: (role: string, options?: any) => HTMLElement[];
    getAllByTestId: (testId: string) => HTMLElement[];
  }

  export function render(ui: ReactElement, options?: RenderOptions): RenderResult;

  export const fireEvent: {
    (element: Document | Element | Window, event: Event): boolean;
    click: (element: Element, eventInit?: EventInit) => boolean;
    change: (element: Element, eventInit?: EventInit | { target: { value: string } }) => boolean;
    submit: (element: Element, eventInit?: EventInit) => boolean;
    focus: (element: Element, eventInit?: EventInit) => boolean;
    blur: (element: Element, eventInit?: EventInit) => boolean;
    keyDown: (element: Element, eventInit?: EventInit) => boolean;
    keyUp: (element: Element, eventInit?: EventInit) => boolean;
    keyPress: (element: Element, eventInit?: EventInit) => boolean;
    mouseDown: (element: Element, eventInit?: EventInit) => boolean;
    mouseUp: (element: Element, eventInit?: EventInit) => boolean;
    mouseEnter: (element: Element, eventInit?: EventInit) => boolean;
    mouseLeave: (element: Element, eventInit?: EventInit) => boolean;
    mouseMove: (element: Element, eventInit?: EventInit) => boolean;
    input: (element: Element, eventInit?: EventInit | { target: { value: string } }) => boolean;
    paste: (element: Element, eventInit?: EventInit) => boolean;
    scroll: (element: Element, eventInit?: EventInit) => boolean;
  };

  export interface MatcherOptions {
    exact?: boolean;
    normalizer?: (text: string) => string;
    trim?: boolean;
    collapseWhitespace?: boolean;
  }
}

declare module '@testing-library/react' {
  export const screen: {
    getByText: (text: string | RegExp) => HTMLElement;
    getByRole: (role: string, options?: any) => HTMLElement;
    getByTestId: (testId: string) => HTMLElement;
    getByPlaceholderText: (text: string | RegExp) => HTMLElement;
    getByLabelText: (text: string | RegExp) => HTMLElement;
    getByDisplayValue: (value: string | RegExp) => HTMLElement;
    getByAltText: (text: string | RegExp) => HTMLElement;
    getByTitle: (title: string | RegExp) => HTMLElement;
    queryByText: (text: string | RegExp) => HTMLElement | null;
    queryByRole: (role: string, options?: any) => HTMLElement | null;
    queryByTestId: (testId: string) => HTMLElement | null;
    queryByPlaceholderText: (text: string | RegExp) => HTMLElement | null;
    queryByLabelText: (text: string | RegExp) => HTMLElement | null;
    queryByDisplayValue: (value: string | RegExp) => HTMLElement | null;
    queryByAltText: (text: string | RegExp) => HTMLElement | null;
    queryByTitle: (title: string | RegExp) => HTMLElement | null;
    findAllByText: (text: string | RegExp) => Promise<HTMLElement[]>;
    findByText: (text: string | RegExp) => Promise<HTMLElement>;
    findByRole: (role: string, options?: any) => Promise<HTMLElement>;
    findByTestId: (testId: string) => Promise<HTMLElement>;
    getAllByText: (text: string | RegExp) => HTMLElement[];
    getAllByRole: (role: string, options?: any) => HTMLElement[];
    getAllByTestId: (testId: string) => HTMLElement[];
    debug: (element?: HTMLElement | HTMLElement[]) => void;
  };

  export function waitFor<T>(callback: () => T | Promise<T>, options?: { timeout?: number; interval?: number }): Promise<T>;
  export function act(callback: () => void | Promise<void>): void;
}

declare module '@testing-library/jest-dom' {
  export {};
}
