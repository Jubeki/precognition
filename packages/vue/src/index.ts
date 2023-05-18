import { Config, RequestMethod, client, toSimpleValidationErrors } from 'laravel-precognition'
import { Form } from './types'
import { reactive, ref } from 'vue'
import cloneDeep from 'lodash.clonedeep'

export const useForm = <Data extends Record<string, unknown>>(method: RequestMethod, url: string, input: Data, config: Config = {}): Data&Form<Data> => {
    method = method.toLowerCase() as RequestMethod

    /**
     * The original data.
     */
    const originalData = cloneDeep(input)

    /**
     * The original input names.
     */
    const originalInputs = Object.keys(originalData) as (keyof Data)[]

    /**
     * The validator instance.
     */
    const validator = client.validator(client => method === 'get' || method === 'delete'
        ? client[method](url, config)
        : client[method](url, form.data(), config))

    /**
     * Reactive valid state.
     */
    const valid = ref<string[]>([])

    /**
     * Reactive touched state.
     */
    const touched = ref<string[]>([])

    /**
     * The event listeners.
     */
    validator.on('validatingChanged', () => form.validating = validator.validating())

    validator.on('touchedChanged', () => {
        touched.value = validator.touched()

        valid.value = validator.valid()
    })

    validator.on('errorsChanged', () => {
        form.hasErrors = validator.hasErrors()

        valid.value = validator.valid()

        const errors = toSimpleValidationErrors(validator.errors())

        // @ts-ignore
        originalInputs.forEach((name) => (form.errors[name] = errors[name]))
    })

    /**
     * Create a new form instance.
     */
    const createForm = (): Data&Form<Data> => ({
        ...cloneDeep(originalData),
        processing: false,
        data() {
            return originalInputs.reduce((carry, name) => ({
                ...carry,
                // @ts-ignore
                [name]: this[name],
            }), ({} as Partial<Data>)) as Data
        },
        errors: {} as Record<keyof Data, string>,
        hasErrors: false,
        setErrors(errors) {
            validator.setErrors(errors)

            return this
        },
        clearErrors() {
            return this.setErrors({})
        },
        reset(...names) {
            const data = cloneDeep(originalData)

            names = (names.length === 0 ? originalInputs : names)

            // @ts-ignore
            names.forEach(name => (this[name] = data[name]))

            validator.reset()

            return this
        },

        validating: false,
        touched(name) {
            // @ts-ignore
            return touched.value.includes(name)
        },
        valid(name) {
            // @ts-ignore
            return valid.value.includes(name)
        },
        invalid(name) {
            return typeof this.errors[name] !== 'undefined'
        },
        validate(input) {
            // @ts-ignore
            validator.validate(input)

            return this
        },
        setValidationTimeout(duration) {
            validator.setTimeout(duration)

            return this
        },
        async submit(userConfig = {}): Promise<unknown> {
            const config: Config = {
                ...userConfig,
                precognitive: false,
                onStart: () => (this.processing = true),
                onFinish: () => (this.processing = false),
                onValidationError: (response, error) => {
                    validator.setErrors(response.data.errors)

                    return userConfig.onValidationError
                        ? userConfig.onValidationError(response)
                        : Promise.reject(error)
                },
            }

            return (method === 'get' || method === 'delete'
                ? client[method](url, config)
                : client[method](url, this.data(), config))
        },
    })

    /**
     * The form instance.
     */
    const form = reactive(createForm()) as Data&Form<Data>

    return form
}
