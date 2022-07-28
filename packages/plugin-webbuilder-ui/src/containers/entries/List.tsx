import gql from 'graphql-tag';
import { graphql } from 'react-apollo';
import React from 'react';
import * as compose from 'lodash.flowright';
import List from '../../components/entries/List';
import { queries, mutations } from '../../graphql';
import { Alert, confirm } from '@erxes/ui/src/utils';
import {
  EntriesQueryResponse,
  EntriesRemoveMutationResponse,
  TypeDetailQueryResponse
} from '../../types';

type Props = {
  history: any;
  queryParams: any;
  getActionBar: (actionBar: any) => void;
};

type FinalProps = {
  entriesQuery: EntriesQueryResponse;
  contentTypeDetailQuery: TypeDetailQueryResponse;
} & Props &
  EntriesRemoveMutationResponse;

function ListContainer(props: FinalProps) {
  const { entriesQuery, contentTypeDetailQuery, entriesRemoveMutation } = props;

  if (contentTypeDetailQuery.loading) {
    return null;
  }

  const remove = (_id: string) => {
    confirm().then(() => {
      entriesRemoveMutation({ variables: { _id } })
        .then(() => {
          Alert.success('Successfully deleted a entry');

          entriesQuery.refetch();
        })
        .catch(e => {
          Alert.error(e.message);
        });
    });
  };

  const entries = entriesQuery.webbuilderEntries || [];
  const contentType = contentTypeDetailQuery.webbuilderContentTypeDetail || {};

  const updatedProps = {
    ...props,
    entries,
    loading: entriesQuery.loading,
    contentType,
    remove
  };

  return <List {...updatedProps} />;
}

export default compose(
  graphql<Props, EntriesQueryResponse>(gql(queries.entries), {
    name: 'entriesQuery',
    options: ({ queryParams }) => ({
      variables: {
        contentTypeId: queryParams.contentTypeId || ''
      }
    })
  }),
  graphql<Props, TypeDetailQueryResponse>(gql(queries.contentTypeDetail), {
    name: 'contentTypeDetailQuery',
    options: ({ queryParams }) => ({
      variables: {
        _id: queryParams.contentTypeId || ''
      }
    })
  }),
  graphql<{}, EntriesRemoveMutationResponse>(gql(mutations.entriesRemove), {
    name: 'entriesRemoveMutation'
  })
)(ListContainer);
