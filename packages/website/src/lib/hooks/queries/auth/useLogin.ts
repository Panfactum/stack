import type { LoginReturnType } from '@panfactum/primary-api'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { postLogin } from '@/lib/clients/api/postLogin'
import { postMasquerade } from '@/lib/clients/api/postMasquerade'
import { postUndoMasquerade } from '@/lib/clients/api/postUndoMasquerade'

interface ILoginWithPasswordProps {
  loginMethod: 'password'
  email: string;
  password: string;
}

interface ILoginByMasqueradeProps {
  loginMethod: 'masquerade'
  targetUserId: string;
}

interface ILoginByUndoMasqueradeProps {
  loginMethod: 'undo-masquerade'
}

type LoginProps = ILoginByMasqueradeProps | ILoginWithPasswordProps | ILoginByUndoMasqueradeProps

export function useLogin () {
  const queryClient = useQueryClient()
  return useMutation<LoginReturnType, Error, LoginProps>({
    mutationFn: async (props) => {
      const { loginMethod } = props
      if (loginMethod === 'password') {
        return await postLogin(props.email, props.password)
      } else if (loginMethod === 'masquerade') {
        return await postMasquerade(props.targetUserId)
      } else if (loginMethod === 'undo-masquerade') {
        return await postUndoMasquerade()
      } else {
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        throw new Error(`Unsupported login method: ${loginMethod}`)
      }
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['identity'], data)
    }
  })
}
