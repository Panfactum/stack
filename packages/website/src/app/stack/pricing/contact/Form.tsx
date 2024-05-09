'use client'

import type { TextFieldProps } from '@mui/material'
import TextField from '@mui/material/TextField'
import Link from 'next/link'
import Script from 'next/script'
import type { FormEvent } from 'react'
import { forwardRef, useMemo, useState } from 'react'

const CustomTextField = forwardRef<HTMLInputElement, TextFieldProps>((props, ref) => {
  return (
    <TextField
      variant="filled"
      size="small"
      className="w-full"
      InputProps={{
        className: 'bg-white'
      }}
      InputLabelProps={{
        className: 'font-medium'
      }}
      ref={ref}
      {...props}
    />
  )
})

// We are somewhat limited on what can be entered on the form as it must match
// the exact specifications provided by Zoho CRM and we can really only update the styling
export default function Form () {
  const [submitted, setSubmitted] = useState(false)

  const onSubmit = useMemo(() => (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = event.target as HTMLFormElement
    void fetch('https://crm.zoho.com/crm/WebToLeadForm', {
      method: 'POST',
      body: new FormData(form)
    }).then(() => {
      setSubmitted(true)
    })
  }, [])

  return (
    <>
      {process.env.NODE_ENV === 'production' && (
        <Script
          id='wf_anal'
          src='https://crm.zohopublic.com/crm/WebFormAnalyticsServeServlet?rid=3930c26939a8e8541043024acdd375e915b47c22cca5287eae50d6a48aca2e928ab0759a946e7313f936628a01b8eacegid734eafc545bf9fd3c8ceeaf6ec9d7d50ecbbe2a87b95b9d86b718a195f4b463egid9c6037f80d65f3f1576d19b7744c2e13f595fd79980c6f6f68a37b4032046511gid9307cefe65c7f0772ec4ee625298125d53b4df318772656138ee116353de218f&tw=c594c3428c160043955666b3c1de01fa5d55eb0b36b42ebe1032ef61c9a665c6'
          strategy="lazyOnload"
        />
      )}

      <form
        id='webform6107827000000673203'
        name="WebToLeads6107827000000673203"
        onSubmit={onSubmit}
        acceptCharset='UTF-8'
        className={`p-4 flex flex-col gap-4 bg-neutral rounded-xl w-full max-w-3xl mx-auto ${submitted ? 'hidden' : ''}`}
      >
        <input
          type='text'
          style={{ display: 'none' }}
          name='xnQsjsdp'
          value='b2638506f2e9154f5187b255620de1d7799e8582bab1b4a7862593349b0872ad'
          readOnly={true}
        />
        <input
          type='hidden'
          name='zc_gad'
          id='zc_gad'
          value=''
          readOnly={true}
        />
        <input
          type='text'
          style={{ display: 'none' }}
          name='xmIwtLD'
          value='1fad25d71cfa65bfee69bb1fea23e25fe0d0732b89faa35ddf4626676cca59d854886c40eb13d1c6a560b211973b5410'
          readOnly={true}
        />
        <input
          type='text'
          style={{ display: 'none' }}
          name='actionType'
          value='TGVhZHM='
          readOnly={true}
        />
        <CustomTextField
          type='text'
          id='First_Name'
          name='First Name'
          label={'First Name'}
          required={true}
        />

        <CustomTextField
          type='text'
          id='Last_Name'
          name='Last Name'
          label={'Last Name'}
          required={true}
        />

        <CustomTextField
          type='email'
          autoComplete='false'
          id='Email'
          name='Email'
          label={'Email'}
          required={true}
        />

        <CustomTextField
          type='text'
          id='Company'
          name='Company'
          label={'Company Name'}
          required={true}
        />

        <CustomTextField
          type='text'
          id='Website'
          name='Website'
          label={'Company Website'}
          required={true}
        />

        <CustomTextField
          id='LEADCF1'
          name='LEADCF1'
          label={'Questions or additional comments?'}
          multiline={true}
        />
        <button
          type="submit"
          className="py-1 text-lg bg-primary text-white rounded font-medium"
        >
          Submit
        </button>
      </form>

      <div className={`bg-neutral p-4 text-center text-xl font-medium tracking-wide w-full max-w-3xl rounded-xl ${!submitted ? 'hidden' : ''}`}>
        We will be in touch! In the meantime, if you have any questions, you can reach out directly to
        {' '}
        <Link
          href={'mailto:sales@panfactum.com'}
          className="text-primary"
        >
          sales@panfactum.com
        </Link>
        .
      </div>
    </>
  )
}
